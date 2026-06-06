import { describe, it, expect } from 'vitest';
import { parseRawSticker, mergeStickerFields } from './parseRaw';
import type { StickerFields } from './types';

const RAW = 'Sparky Прахов ABC 6 кг\nСериен No: SP-0036 Година: 2022\nТО: 01.12.2025 Годен до: 2037';

describe('parseRawSticker', () => {
  it('извлича полета от суров OCR текст', () => {
    const f = parseRawSticker(RAW);
    expect(f).toMatchObject({
      brand: 'Sparky',
      type: 'powder_abc',
      capacityKg: 6,
      serial: 'SP-0036',
      year: 2022,
      scrapYear: 2037,
    });
    expect(f.stamps).toEqual([{ kind: 'TO', date: '2025-12-01' }]);
  });

  it('празен текст → празно', () => {
    expect(parseRawSticker('')).toEqual({});
  });
});

describe('mergeStickerFields', () => {
  it('допълва липсващите полета от parsed', () => {
    const primary: StickerFields = {
      brand: null, model: null, serial: null, year: null, type: 'powder_abc',
      capacityKg: null, agent: null, stamps: [], scrapYear: 2037,
    };
    const merged = mergeStickerFields(primary, parseRawSticker(RAW));
    expect(merged.serial).toBe('SP-0036');
    expect(merged.year).toBe(2022);
    expect(merged.capacityKg).toBe(6);
    expect(merged.type).toBe('powder_abc'); // запазено от primary
    expect(merged.scrapYear).toBe(2037);
    expect(merged.stamps).toEqual([{ kind: 'TO', date: '2025-12-01' }]);
  });
});
