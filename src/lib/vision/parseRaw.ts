import { normalizeType, parseFlexDate } from '@/lib/import/normalize';
import type { StickerFields } from './types';

const KNOWN_BRANDS = [
  'Солти', 'Огнехром', 'Огниохрон', 'Торнадо', 'Дрипалдер', 'Ятрус', 'Sparky', 'Gloria',
  'Bavaria', 'Total', 'Ceasefire', 'Minimax', 'Tyco', 'Sicli', 'Chubb', 'FirePro', 'Ansul',
  'Kidde', 'Amerex', 'Pastor', 'Полуш', 'Огнеборец', 'Спарк',
];

/** Извлича структурирани полета от суров OCR текст (BG стикер). */
export function parseRawSticker(raw: string): Partial<StickerFields> {
  const t = (raw ?? '').replace(/\r/g, ' ');
  const out: Partial<StickerFields> = {};
  if (!t.trim()) return out;

  for (const b of KNOWN_BRANDS) {
    if (new RegExp(b, 'i').test(t)) {
      out.brand = b;
      break;
    }
  }

  const ty = normalizeType(t);
  if (ty) out.type = ty;

  const cap = /(\d+(?:[.,]\d+)?)\s*(?:кг|kg|л|l)(?![а-яА-Яa-z])/i.exec(t);
  if (cap) out.capacityKg = Number(cap[1].replace(',', '.'));

  const ser = /сериен[^:\n]*[:\s]\s*([A-Za-z0-9][A-Za-z0-9\-_/]{2,})/i.exec(t);
  if (ser) out.serial = ser[1];

  const yr = /(?:година|год\.?|произв)[^\d]{0,6}(\d{4})/i.exec(t);
  if (yr) out.year = Number(yr[1]);

  const sc = /(?:годен\s*до|щампа)[^\d]{0,6}(\d{4})/i.exec(t);
  if (sc) out.scrapYear = Number(sc[1]);

  const stamps: StickerFields['stamps'] = [];
  const grab = (re: RegExp): string | null => {
    const m = re.exec(t);
    return m ? parseFlexDate(m[1]) : null;
  };
  const to = grab(/(?:^|[\s;.,])ТО[^\d]{0,6}(\d{1,2}\.\d{1,2}\.\d{4})/i);
  if (to) stamps.push({ kind: 'TO', date: to });
  const pz = grab(/(?:презареж|смяна)[^\d]{0,14}(\d{1,2}\.\d{1,2}\.\d{4})/i);
  if (pz) stamps.push({ kind: 'recharge', date: pz });
  const hi = grab(/(?:хидрост|(?:^|[\s;.,])ХИ)[^\d]{0,6}(\d{1,2}\.\d{1,2}\.\d{4})/i);
  if (hi) stamps.push({ kind: 'HI', date: hi });
  if (stamps.length) out.stamps = stamps;

  return out;
}

/** Слива разпознати полета: ползва primary, ако е налично; иначе допълва от extra. */
export function mergeStickerFields(primary: StickerFields, extra: Partial<StickerFields>): StickerFields {
  const has = (v: unknown) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
  const out = { ...primary };
  (Object.keys(extra) as (keyof StickerFields)[]).forEach((k) => {
    if (!has(out[k]) && has(extra[k])) {
      // @ts-expect-error индексирано присвояване между съвместими полета
      out[k] = extra[k];
    }
  });
  return out;
}
