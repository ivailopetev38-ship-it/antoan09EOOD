import { normalizeType, parseYear, parseFlexDate, parseNumber } from './normalize';
import type { ParsedRow, ParseResult, ImportError } from './types';

// синоними на колони → вътрешен ключ
const COLS: Record<string, string> = {
  'клиент': 'client', 'обект': 'site', 'марка': 'brand', 'модел': 'model',
  'сериен': 'serial', 'сериен №': 'serial', 'сериен номер': 'serial',
  'тип': 'type', 'вид': 'type', 'капацитет': 'capacity', 'маса': 'capacity',
  'обща маса': 'grossMass', 'обща_маса': 'grossMass', 'бруто': 'grossMass', 'бруто маса': 'grossMass',
  'категория': 'category', 'категория на пожарогасителя': 'category',
  'година': 'year', 'щампа': 'stamp', 'щампа-година': 'stamp',
  'последно_то': 'lastTO', 'последно то': 'lastTO',
  'последно_пз': 'lastRecharge', 'последно пз': 'lastRecharge',
  'последно_хи': 'lastHI', 'последно хи': 'lastHI',
  'техник': 'technician', 'забележки': 'notes', 'забележка': 'notes',
};

function detectDelimiter(line: string): string {
  if (line.includes('\t')) return '\t';
  if (line.includes(';')) return ';';
  return ',';
}

function clean(s: string | undefined): string {
  return (s ?? '').trim();
}

export function parseImport(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return { rows: [], errors: [] };

  const delim = detectDelimiter(lines[0]);
  const headerKeys = lines[0].split(delim).map((h) => COLS[h.trim().toLowerCase()] ?? '');

  const rows: ParsedRow[] = [];
  const errors: ImportError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim);
    const rec: Record<string, string> = {};
    headerKeys.forEach((key, idx) => {
      if (key) rec[key] = clean(cells[idx]);
    });

    const lineNo = i + 1; // 1-базиран, хедърът е ред 1
    const missing: string[] = [];
    if (!rec.client) missing.push('клиент');
    if (!rec.site) missing.push('обект');
    if (!rec.serial) missing.push('сериен');
    if (missing.length) {
      errors.push({ line: lineNo, message: `Липсва: ${missing.join(', ')}` });
      continue;
    }
    const type = normalizeType(rec.type ?? '');
    if (!type) {
      errors.push({ line: lineNo, message: `Непознат тип: „${rec.type ?? ''}"` });
      continue;
    }
    const year = parseYear(rec.year ?? '');
    if (!year) {
      errors.push({ line: lineNo, message: `Невалидна година: „${rec.year ?? ''}"` });
      continue;
    }
    rows.push({
      client: rec.client,
      site: rec.site,
      brand: rec.brand || null,
      model: rec.model || null,
      type,
      serial: rec.serial,
      year,
      stampYear: parseYear(rec.stamp ?? ''),
      massKg: parseNumber(rec.capacity ?? ''),
      grossMassKg: parseNumber(rec.grossMass ?? ''),
      category: rec.category || null,
      lastTO: parseFlexDate(rec.lastTO ?? ''),
      lastRecharge: parseFlexDate(rec.lastRecharge ?? ''),
      lastHI: parseFlexDate(rec.lastHI ?? ''),
      technician: rec.technician || null,
      notes: rec.notes || null,
    });
  }
  return { rows, errors };
}
