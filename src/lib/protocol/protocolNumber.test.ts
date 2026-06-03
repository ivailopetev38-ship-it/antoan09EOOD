import { describe, it, expect } from 'vitest';
import { nextProtocolNumber } from './protocolNumber';

describe('nextProtocolNumber', () => {
  it('форматира като пореден/година', () => {
    expect(nextProtocolNumber(2026, 54)).toBe('55/2026');
  });
  it('започва от 1 за нова година', () => {
    expect(nextProtocolNumber(2027, 0)).toBe('1/2027');
  });
});
