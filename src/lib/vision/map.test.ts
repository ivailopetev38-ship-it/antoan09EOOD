import { describe, it, expect } from 'vitest';
import { stampsToHistory, stickerToEngineInput } from './map';
import type { StickerFields } from './types';

const base: StickerFields = {
  brand: 'Sparky',
  model: 'Спарк 6 кг',
  serial: '0036',
  year: 2022,
  type: 'powder_abc',
  capacityKg: 6,
  agent: 'Кобра ABC 50',
  stamps: [
    { kind: 'TO', date: '2024-12-01' },
    { kind: 'TO', date: '2025-12-01' },
    { kind: 'recharge', date: '2025-12-01' },
  ],
  scrapYear: 2037,
};

describe('stampsToHistory', () => {
  it('взима най-късната дата по тип', () => {
    expect(stampsToHistory(base.stamps)).toEqual({
      lastTO: '2025-12-01',
      lastRecharge: '2025-12-01',
      lastHI: null,
    });
  });
  it('празно → null', () => {
    expect(stampsToHistory([])).toEqual({ lastTO: null, lastRecharge: null, lastHI: null });
  });
});

describe('stickerToEngineInput', () => {
  it('строи вход за двигателя', () => {
    const inp = stickerToEngineInput(base, '2026-06-05');
    expect(inp).toMatchObject({
      type: 'powder_abc',
      manufactureYear: 2022,
      stampYear: 2037,
      lastTO: '2025-12-01',
      today: '2026-06-05',
    });
  });
  it('връща null без тип или година', () => {
    expect(stickerToEngineInput({ ...base, type: null }, '2026-06-05')).toBeNull();
    expect(stickerToEngineInput({ ...base, year: null }, '2026-06-05')).toBeNull();
  });
});
