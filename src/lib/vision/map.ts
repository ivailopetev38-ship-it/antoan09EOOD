import type { EngineInput } from '@/lib/regulatory/types';
import type { StickerFields } from './types';

export function stampsToHistory(stamps: StickerFields['stamps']): {
  lastTO: string | null;
  lastRecharge: string | null;
  lastHI: string | null;
} {
  const h = {
    lastTO: null as string | null,
    lastRecharge: null as string | null,
    lastHI: null as string | null,
  };
  for (const s of stamps) {
    if (s.kind === 'TO') {
      if (!h.lastTO || s.date > h.lastTO) h.lastTO = s.date;
    } else if (s.kind === 'recharge') {
      if (!h.lastRecharge || s.date > h.lastRecharge) h.lastRecharge = s.date;
    } else if (s.kind === 'HI') {
      if (!h.lastHI || s.date > h.lastHI) h.lastHI = s.date;
    }
  }
  return h;
}

export function stickerToEngineInput(f: StickerFields, today: string): EngineInput | null {
  if (!f.type || !f.year) return null;
  const h = stampsToHistory(f.stamps);
  return {
    type: f.type,
    manufactureYear: f.year,
    stampYear: f.scrapYear,
    lastTO: h.lastTO,
    lastRecharge: h.lastRecharge,
    lastHI: h.lastHI,
    today,
  };
}
