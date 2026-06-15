import { describe, it, expect } from 'vitest';
import { deriveCategory } from './category';

describe('deriveCategory (БДС ISO 11602-2, под налягане)', () => {
  it('воден/водопенен → К1', () => {
    expect(deriveCategory('water')).toBe('К1');
    expect(deriveCategory('foam')).toBe('К1');
  });
  it('прахов (ABC/BC) → К2', () => {
    expect(deriveCategory('powder_abc')).toBe('К2');
    expect(deriveCategory('powder_bc')).toBe('К2');
  });
  it('CO2 → К5', () => {
    expect(deriveCategory('co2')).toBe('К5');
  });
});
