import { normalizeType, parseFlexDate } from '@/lib/import/normalize';
import type { StickerFields } from './types';

const KNOWN_BRANDS = [
  'Солти', 'Огнехром', 'Торнадо', 'Дрипалдер', 'Ятрус', 'Sparky', 'Gloria', 'Bavaria', 'Total',
  'Ceasefire', 'Minimax', 'Tyco', 'Sicli', 'Chubb', 'FirePro', 'Ansul', 'Kidde', 'Amerex', 'Pastor',
];

const DATE = '(\\d{1,2}\\.\\d{1,2}\\.\\d{4}|\\d{4}-\\d{2}-\\d{2})';
function toIso(d: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : parseFlexDate(d);
}

// Разстояние на Левенщайн (за толериране на OCR грешки в марката).
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** Намира марка в текста: първо точно (substring), после размито (OCR грешки). */
function detectBrand(lower: string): string | undefined {
  for (const b of KNOWN_BRANDS) {
    if (lower.includes(b.toLowerCase())) return b;
  }
  const words = lower.split(/[^a-zа-я0-9]+/i).filter((w) => w.length >= 4);
  for (const b of KNOWN_BRANDS) {
    const bl = b.toLowerCase();
    const tol = bl.length >= 6 ? 2 : 1;
    for (const w of words) {
      if (Math.abs(w.length - bl.length) <= tol && lev(w, bl) <= tol) return b;
    }
  }
  return undefined;
}

/** Двуезичен (BG/EN), толерантен парсер на суров OCR текст → структурирани полета. */
export function parseRawSticker(raw: string): Partial<StickerFields> {
  const t = (raw ?? '').replace(/\r/g, ' ');
  const out: Partial<StickerFields> = {};
  if (!t.trim()) return out;

  const brand = detectBrand(t.toLowerCase());
  if (brand) out.brand = brand;

  const md = /(?:модел|model)\s*[:.\-]?\s*([A-Za-zА-Яа-я0-9][^\n]{1,38})/i.exec(t);
  if (md) out.model = md[1].trim().replace(/\s{3,}.*$/, '').trim();

  const ty = normalizeType(t);
  if (ty) out.type = ty;

  const cap = /(\d+(?:[.,]\d+)?)\s*(?:кг|kg|л|l)(?![а-яА-Яa-z])/i.exec(t);
  if (cap) out.capacityKg = Number(cap[1].replace(',', '.'));

  // сериен № — толерантен към OCR-интервали и тирета (напр. „ABC  -  1002" → „ABC-1002")
  const ser = /(?:сериен|serial)[^\n]{0,18}?([A-Za-z]{0,5}\s{0,3}[-–—]?\s{0,3}\d[A-Za-z0-9\-–—_/]*)/i.exec(t);
  if (ser) out.serial = ser[1].replace(/[–—]/g, '-').replace(/\s+/g, '').replace(/^-+/, '');

  // година на производство (предпочита „производство", после общо „година/year"; „годен до" ≠ „година")
  const yr = /(?:произв\w*|production|година|year)[^\d\n]{0,12}(\d{4})/i.exec(t);
  if (yr) out.year = Number(yr[1]);

  const sc = /(?:годен\s*до|щампа|scrap)[^\d\n]{0,12}(\d{4})/i.exec(t);
  if (sc) out.scrapYear = Number(sc[1]);

  const stamps: StickerFields['stamps'] = [];
  const grab = (re: RegExp): string | null => {
    const m = re.exec(t);
    return m ? toIso(m[1]) : null;
  };
  const to = grab(new RegExp('(?:^|[\\s;.,])(?:ТО|TO)[^\\d]{0,6}' + DATE, 'i'));
  if (to) stamps.push({ kind: 'TO', date: to });
  const pz = grab(new RegExp('(?:презареж|смяна|recharge)[^\\d]{0,14}' + DATE, 'i'));
  if (pz) stamps.push({ kind: 'recharge', date: pz });
  const hi = grab(new RegExp('(?:хидрост|(?:^|[\\s;.,])(?:ХИ|HI))[^\\d]{0,6}' + DATE, 'i'));
  if (hi) stamps.push({ kind: 'HI', date: hi });
  if (stamps.length) out.stamps = stamps;

  return out;
}

/** Слива полета: ползва primary, ако е налично; иначе допълва от extra. */
export function mergeStickerFields(primary: Partial<StickerFields>, extra: Partial<StickerFields>): StickerFields {
  const has = (v: unknown) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
  const base: StickerFields = {
    brand: null, model: null, serial: null, year: null, type: null, capacityKg: null, agent: null, stamps: [], scrapYear: null,
  };
  const out = { ...base, ...primary } as StickerFields;
  (Object.keys(base) as (keyof StickerFields)[]).forEach((k) => {
    if (!has(out[k]) && has(extra[k])) {
      // @ts-expect-error съвместимо индексирано присвояване
      out[k] = extra[k];
    }
  });
  return out;
}
