import { describe, it, expect } from 'vitest';
import { normalizeType, parseYear, parseFlexDate, parseNumber } from './normalize';

describe('normalizeType', () => {
  it('разпознава прахов ABC', () => {
    expect(normalizeType('прахов ABC')).toBe('powder_abc');
    expect(normalizeType('прах abc')).toBe('powder_abc');
  });
  it('разпознава прахов BC', () => {
    expect(normalizeType('прахов BC')).toBe('powder_bc');
  });
  it('разпознава воден/водопенен/CO2', () => {
    expect(normalizeType('воден')).toBe('water');
    expect(normalizeType('вода')).toBe('water');
    expect(normalizeType('водопенен')).toBe('foam');
    expect(normalizeType('пяна')).toBe('foam');
    expect(normalizeType('CO2')).toBe('co2');
    expect(normalizeType('въглероден диоксид')).toBe('co2');
  });
  it('връща null при непознат тип', () => {
    expect(normalizeType('нещо')).toBeNull();
    expect(normalizeType('')).toBeNull();
  });
});

describe('parseYear', () => {
  it('чете 4-цифрена година', () => {
    expect(parseYear('2019')).toBe(2019);
    expect(parseYear(' 2024 ')).toBe(2024);
  });
  it('връща null при невалидна', () => {
    expect(parseYear('19')).toBeNull();
    expect(parseYear('')).toBeNull();
    expect(parseYear('abcd')).toBeNull();
  });
});

describe('parseFlexDate', () => {
  it('чете dd.mm.yyyy → ISO', () => {
    expect(parseFlexDate('27.05.2026')).toBe('2026-05-27');
    expect(parseFlexDate('1.6.2025')).toBe('2025-06-01');
  });
  it('приема ISO както е', () => {
    expect(parseFlexDate('2025-12-01')).toBe('2025-12-01');
  });
  it('празно → null', () => {
    expect(parseFlexDate('')).toBeNull();
    expect(parseFlexDate('  ')).toBeNull();
  });
});

describe('parseNumber', () => {
  it('чете число с единица и запетая', () => {
    expect(parseNumber('6 кг')).toBe(6);
    expect(parseNumber('9 л')).toBe(9);
    expect(parseNumber('1,600')).toBeCloseTo(1.6);
    expect(parseNumber('50')).toBe(50);
  });
  it('празно → null', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('-')).toBeNull();
  });
});
