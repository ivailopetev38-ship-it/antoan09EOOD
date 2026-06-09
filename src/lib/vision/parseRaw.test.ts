import { describe, it, expect } from 'vitest';
import { parseRawSticker, mergeStickerFields } from './parseRaw';
import type { StickerFields } from './types';

const RAW_BG = 'Sparky Прахов ABC 6 кг\nСериен No: SP-0036 Година: 2022\nТО: 01.12.2025 Годен до: 2037';

// Така изглежда суровият текст, който връща Hermes bridge (английски етикети, ISO дати).
const RAW_EN = [
  'Brand: GLORIA',
  'Model: P 6 ABC',
  'serial No: SN123456',
  'Production year: 2022',
  'Type: powder ABC',
  'Capacity: 6 kg',
  'Extinguishing agent: ABC powder',
  'TO 2024-05-12',
  'Recharge 2025-05-12',
  'HI 2032-05-12',
  'scrap year: 2037',
].join('\n');

describe('parseRawSticker', () => {
  it('извлича полета от български OCR текст', () => {
    const f = parseRawSticker(RAW_BG);
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

  it('извлича полета от английски Hermes текст и чисти серийния №', () => {
    const f = parseRawSticker(RAW_EN);
    expect(f).toMatchObject({
      brand: 'Gloria',
      model: 'P 6 ABC',
      type: 'powder_abc',
      capacityKg: 6,
      serial: 'SN123456', // НЕ „SN123456 Production year..." — само чистият токен
      year: 2022,
      scrapYear: 2037,
    });
    expect(f.stamps).toEqual([
      { kind: 'TO', date: '2024-05-12' },
      { kind: 'recharge', date: '2025-05-12' },
      { kind: 'HI', date: '2032-05-12' },
    ]);
  });

  it('празен текст → празно', () => {
    expect(parseRawSticker('')).toEqual({});
  });
});

describe('mergeStickerFields', () => {
  it('предпочита чистия парсер, допълва липсите от полетата на Hermes', () => {
    // Hermes връща мръсен сериен № (хваща и следващото поле); моят парсер дава чист.
    const fromHermes: StickerFields = {
      brand: 'GLORIA', model: null, serial: 'SN123456 Production year 2022', year: null,
      type: 'powder_abc', capacityKg: 6, agent: 'ABC powder', stamps: [], scrapYear: null,
    };
    const merged = mergeStickerFields(parseRawSticker(RAW_EN), fromHermes);
    expect(merged.serial).toBe('SN123456'); // чистата стойност от моя парсер печели
    expect(merged.model).toBe('P 6 ABC');
    expect(merged.year).toBe(2022);
    expect(merged.agent).toBe('ABC powder'); // допълнено от Hermes (моят парсер не го вади)
    expect(merged.stamps).toHaveLength(3);
  });
});
