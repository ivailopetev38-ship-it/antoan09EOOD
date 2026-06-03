export type ExtinguisherType = 'powder_abc' | 'powder_bc' | 'water' | 'foam' | 'co2';
export type SuggestedAction = 'TO' | 'recharge' | 'HI' | 'scrap';

export interface EngineInput {
  type: ExtinguisherType;
  manufactureYear: number;
  stampYear: number | null;        // макс. година за експлоатация (от щампата)
  lastTO: string | null;           // ISO "YYYY-MM-DD"
  lastRecharge: string | null;     // ISO (П / смяна прах|пяна)
  lastHI: string | null;           // ISO
  today: string;                   // ISO
}

export interface EngineResult {
  suggestedAction: SuggestedAction;
  isScrapped: boolean;
  reasons: string[];
  dueDates: {
    to: string;                    // следващо ТО
    rechargeOrChange: string | null; // следваща 2-год. смяна (null за water/co2)
    hi: string;                    // следващо ХИ
  };
}
