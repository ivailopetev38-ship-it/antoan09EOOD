import { describe, it, expect } from 'vitest';
import { deriveStatus } from './status';
import type { EngineResult } from '@/lib/regulatory/types';

const base: EngineResult = {
  suggestedAction: 'TO',
  isScrapped: false,
  reasons: [],
  dueDates: { to: '2027-01-01', rechargeOrChange: null, hi: '2030-01-01' },
};

describe('deriveStatus', () => {
  it('БРАК при бракуван', () => {
    expect(deriveStatus({ ...base, isScrapped: true }, '2026-06-03').level).toBe('scrap');
  });
  it('просрочен при минала дата', () => {
    const r = deriveStatus({ ...base, dueDates: { to: '2026-05-01', rechargeOrChange: null, hi: '2030-01-01' } }, '2026-06-03');
    expect(r.level).toBe('overdue');
  });
  it('скоро при дата до 30 дни', () => {
    const r = deriveStatus({ ...base, dueDates: { to: '2026-06-20', rechargeOrChange: null, hi: '2030-01-01' } }, '2026-06-03');
    expect(r.level).toBe('soon');
  });
  it('ОК при далечна дата', () => {
    const r = deriveStatus(base, '2026-06-03');
    expect(r.level).toBe('ok');
  });
  it('взима най-ранната дължима дата', () => {
    const r = deriveStatus({ ...base, dueDates: { to: '2030-01-01', rechargeOrChange: '2026-05-01', hi: '2030-01-01' } }, '2026-06-03');
    expect(r.level).toBe('overdue');
    expect(r.nextDue).toBe('2026-05-01');
  });
});
