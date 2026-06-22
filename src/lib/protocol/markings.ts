import type { ExtinguisherType } from '@/lib/regulatory/types';

const CLASS_CODE: Record<ExtinguisherType, string> = {
  powder_abc: 'ABC', powder_bc: 'BC', water: 'W', foam: 'W', co2: 'CO2',
};
const UNIT: Record<ExtinguisherType, string> = {
  powder_abc: 'кг', powder_bc: 'кг', water: 'л', foam: 'л', co2: 'кг',
};

/**
 * Гр.2 „Ид. маркировка": „{марка} {клас} {капацитет} {кг/л} № {сериен} / {година}".
 * Ползва модела, ако е попълнен (пълна свобода); иначе сглобява от марка+клас+капацитет.
 * Като образеца: „Огнехром ABC 2 кг № ABC-1001 / 2014", „Chubb W 9 л № W-1013 / 2013".
 */
export function buildMarkings(o: {
  brand?: string | null; model?: string | null; type?: string | null;
  capacity?: string | number | null; serial?: string | null; year?: string | number | null;
}): string {
  const t = (o.type ?? '') as ExtinguisherType;
  const cls = CLASS_CODE[t] ?? '';
  const unit = UNIT[t] ?? 'кг';
  const capStr = o.capacity != null && String(o.capacity).trim() !== '' ? `${String(o.capacity).trim()} ${unit}` : '';
  const brand = o.brand?.toString().trim();
  // Като образеца: марка+клас+капацитет водят (напр. „Огнехром ABC 2 кг").
  // Моделът е резервен — само когато няма марка (напр. ръчно въведен модел).
  const desc = brand
    ? [brand, cls, capStr].filter(Boolean).join(' ').trim()
    : (o.model && o.model.trim() ? o.model.trim() : [cls, capStr].filter(Boolean).join(' ').trim());
  const serialPart = o.serial && String(o.serial).trim() ? ` № ${String(o.serial).trim()}` : '';
  const yearPart = o.year && String(o.year).trim() ? ` / ${String(o.year).trim()}` : '';
  return `${desc}${serialPart}${yearPart}`.trim();
}
