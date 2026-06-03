import type { EngineInput, EngineResult, SuggestedAction, ExtinguisherType } from './types';

function addYears(iso: string, years: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function has2yChange(type: ExtinguisherType): boolean {
  return type === 'powder_abc' || type === 'powder_bc' || type === 'foam';
}

export function computeExtinguisherStatus(input: EngineInput): EngineResult {
  const today = new Date(input.today + 'T00:00:00Z');
  const reasons: string[] = [];

  const anchor = `${input.manufactureYear}-01-01`;
  const lastTO = input.lastTO ?? anchor;
  const lastRecharge = input.lastRecharge ?? anchor;
  const lastHI = input.lastHI ?? anchor;

  const dueDates = {
    to: addYears(lastTO, 1),
    rechargeOrChange: has2yChange(input.type) ? addYears(lastRecharge, 2) : null,
    hi: addYears(lastHI, 10),
  };

  if (input.stampYear !== null && today.getUTCFullYear() > input.stampYear) {
    reasons.push(`Годината на щампата (${input.stampYear}) е изтекла — БРАК.`);
    return { suggestedAction: 'scrap', isScrapped: true, reasons, dueDates };
  }

  const due = (iso: string | null) => iso !== null && new Date(iso + 'T00:00:00Z') <= today;

  let suggestedAction: SuggestedAction = 'TO';
  if (due(dueDates.hi)) {
    suggestedAction = 'HI';
    reasons.push('Дължимо хидростатично изпитание (10 г.).');
  } else if (due(dueDates.rechargeOrChange)) {
    suggestedAction = 'recharge';
    reasons.push('Дължимо презареждане/смяна (2 г.).');
  } else if (due(dueDates.to)) {
    suggestedAction = 'TO';
    reasons.push('Дължимо годишно техническо обслужване.');
  } else {
    reasons.push('Няма просрочени дейности; предложено е ТО.');
  }

  return { suggestedAction, isScrapped: false, reasons, dueDates };
}
