import { describe, it, expect } from 'vitest';
import { computeExtinguisherStatus } from './engine';

const base = {
  type: 'powder_abc' as const,
  manufactureYear: 2020,
  stampYear: 2035,
  lastTO: null,
  lastRecharge: null,
  lastHI: null,
  today: '2026-06-03',
};

describe('computeExtinguisherStatus', () => {
  it('маркира БРАК, ако текущата година > година на щампата', () => {
    const r = computeExtinguisherStatus({ ...base, stampYear: 2025 });
    expect(r.isScrapped).toBe(true);
    expect(r.suggestedAction).toBe('scrap');
  });

  it('не е БРАК, когато stampYear е null', () => {
    const r = computeExtinguisherStatus({ ...base, stampYear: null });
    expect(r.isScrapped).toBe(false);
  });

  it('предлага ХИ, когато са минали 10 г. от производството без ХИ', () => {
    const r = computeExtinguisherStatus({ ...base, manufactureYear: 2010 });
    expect(r.suggestedAction).toBe('HI');
  });

  it('предлага презареждане за прахов на 2 г. (без ХИ дължимо)', () => {
    const r = computeExtinguisherStatus({
      ...base, manufactureYear: 2024, lastHI: '2024-01-01', lastRecharge: '2024-01-01',
    });
    expect(r.suggestedAction).toBe('recharge');
  });

  it('предлага ТО, когато само годишното ТО е дължимо', () => {
    const r = computeExtinguisherStatus({
      ...base, manufactureYear: 2025, lastHI: '2025-01-01', lastRecharge: '2025-01-01', lastTO: '2025-01-01',
    });
    expect(r.suggestedAction).toBe('TO');
  });

  it('CO2 няма 2-годишна смяна (rechargeOrChange = null)', () => {
    const r = computeExtinguisherStatus({
      ...base, type: 'co2', manufactureYear: 2024, lastHI: '2024-01-01',
    });
    expect(r.dueDates.rechargeOrChange).toBeNull();
    expect(r.suggestedAction).toBe('TO');
  });
});
