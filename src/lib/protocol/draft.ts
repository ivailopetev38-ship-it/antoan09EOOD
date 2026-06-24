import type { ProtocolLineData } from './types';
import { buildMarkings } from './markings';

/** Един ред в кошницата (всички графи на един гасител, редактируеми). */
export interface LineDraft {
  id: string;            // локален id (React key) / id на гасителя при зареждане от обект
  brand: string;
  model: string;
  serial: string;
  year: string;
  type: string;          // powder_abc | powder_bc | water | foam | co2
  cap: string;           // капацитет (кг/л)
  category: string;      // К1–К5 (гр.3)
  totalMass: string;     // обща маса (гр.4)
  action: string;        // TO | recharge | HI (гр.7)
  agentTrade: string;    // търговско наименование (гр.6, при П/ХИ)
  date: string;          // ISO yyyy-mm-dd (гр.8)
  sticker: string;       // № стикер (гр.11)
  tech: string;          // техник (гр.9)
}

export const AGENT_LABEL: Record<string, string> = {
  powder_abc: 'Прах', powder_bc: 'Прах', water: 'Вода', foam: 'Пяна', co2: 'CO2',
};
// Графа 7: ТО винаги присъства; ред ТО → ХИ → ПЗ; презареждане = „ПЗ" (не „П").
export const KIND_LABEL: Record<string, string> = {
  TO: 'ТО', TO_HI: 'ТО + ХИ', TO_PZ: 'ТО + ПЗ', TO_HI_PZ: 'ТО + ХИ + ПЗ',
  recharge: 'ТО + ПЗ', HI: 'ТО + ХИ', // съвместимост със стари стойности
};

/** Стандартни „общи маси" (бруто, кг) по вид + капацитет — графа 4 (редактируеми, индустриално-типични). */
const STD_MASS: Record<string, Record<string, string>> = {
  powder: { '1': '2,0', '2': '3,5', '3': '4,8', '4': '6,4', '6': '9,5', '9': '14,0', '12': '18,5' },
  water: { '6': '9,0', '9': '13,5' },
  foam: { '6': '9,5', '9': '14,0' },
  co2: { '2': '6,5', '5': '14,0', '6': '16,0' },
};
export function stdMass(type: string, cap: string): string {
  const g = type === 'co2' ? 'co2' : type === 'water' ? 'water' : type === 'foam' ? 'foam' : 'powder';
  return STD_MASS[g]?.[String(cap ?? '').trim()] ?? '';
}

/** Само за 1 кг ПРАХОВ: ако не е разчетено — авто 4-цифрен сериен № + скорошна година (2019/2020)
 *  + марка „прахов". За по-големи (≠1 кг) НЕ генерира — там серийният трябва да е реален. */
export function small1kgDefaults(d: LineDraft): LineDraft {
  const isPowder = d.type === 'powder_abc' || d.type === 'powder_bc';
  if (!isPowder || String(d.cap ?? '').trim() !== '1') return d;
  return {
    ...d,
    serial: d.serial.trim() || String(1000 + Math.floor(Math.random() * 9000)),
    year: d.year.trim() || String(2019 + Math.floor(Math.random() * 2)),
    brand: d.brand.trim() || 'прахов',
  };
}

function isoToBg(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}.${m}.${y}` : iso;
}

export function emptyDraft(id: string): LineDraft {
  return {
    id, brand: '', model: '', serial: '', year: '', type: 'powder_abc', cap: '',
    category: 'К2', totalMass: '', action: 'TO', agentTrade: '', date: '', sticker: '', tech: '',
  };
}

/** LineDraft → ред в протокола (ProtocolLineData). Датата се подава като ISO и се форматира. */
export function draftToLine(d: LineDraft, idx: number): ProtocolLineData {
  const massNum = Number((d.totalMass || '0').replace(',', '.'));
  const needsAgent = d.action !== 'TO'; // графа 6 (търговско наименование) при ПЗ или ХИ
  return {
    idx,
    markings: buildMarkings({ brand: d.brand, model: d.model, type: d.type, capacity: d.cap, serial: d.serial, year: d.year }),
    category: d.category,
    mass: massNum ? massNum.toFixed(3).replace('.', ',') : '',
    agent: AGENT_LABEL[d.type] ?? '',
    agentTradeName: needsAgent ? d.agentTrade : '',
    serviceKind: KIND_LABEL[d.action] ?? d.action,
    serviceDate: isoToBg(d.date),
    technicianName: d.tech,
    stickerNo: d.sticker,
  };
}
