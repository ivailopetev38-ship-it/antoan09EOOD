import type { ExtinguisherType } from '@/lib/regulatory/types';

export function normalizeType(raw: string): ExtinguisherType | null {
  const t = ` ${raw.toLowerCase().trim()} `;
  if (!t.trim()) return null;
  if (/со2|co2|въглерод/.test(t)) return 'co2';
  if (/водопен|пяна|пенопен|foam/.test(t)) return 'foam';
  // Прах преди вода: иначе „производство" (съдържа „вод") би подвело при прахов стикер.
  if (/прах|powder/.test(t)) {
    if (/\bbc\b|\sbc\s|бц/.test(t)) return 'powder_bc';
    return 'powder_abc';
  }
  // Само цели думи за вода — НЕ голо „вод" (за да не лови „производство", „проводник" и др.).
  if (/вода|воден|водна|водни|water/.test(t)) return 'water';
  return null;
}

export function parseYear(raw: string): number | null {
  const m = /\b(\d{4})\b/.exec(raw.trim());
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1950 && y <= 2100 ? y : null;
}

export function parseFlexDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return s;
  const bg = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (bg) {
    const d = bg[1].padStart(2, '0');
    const m = bg[2].padStart(2, '0');
    return `${bg[3]}-${m}-${d}`;
  }
  return null;
}

export function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  const m = /-?\d+(\.\d+)?/.exec(s);
  if (!m) return null;
  return Number(m[0]);
}
