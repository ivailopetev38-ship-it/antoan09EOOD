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
export const KIND_LABEL: Record<string, string> = { TO: 'ТО', recharge: 'П', HI: 'ХИ' };

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
  const needsAgent = d.action === 'recharge' || d.action === 'HI';
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
