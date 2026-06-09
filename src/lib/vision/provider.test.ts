import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getVisionProvider } from './provider';

describe('getVisionProvider (Hermes адаптер)', () => {
  const OLD_URL = process.env.HERMES_VISION_URL;
  beforeEach(() => { process.env.HERMES_VISION_URL = 'http://example.test/vision'; });
  afterEach(() => {
    if (OLD_URL === undefined) delete process.env.HERMES_VISION_URL;
    else process.env.HERMES_VISION_URL = OLD_URL;
    vi.unstubAllGlobals();
  });

  it('при грешка от Hermes връща ПРАЗНО (без фалшив сериен № → без лъжливо съвпадение)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    const r = await getVisionProvider().recognize('x');
    expect(r.fields.serial).toBeNull();
    expect(r.fields.brand).toBeNull();
    expect(r.confidence).toBe(0);
  });

  it('при HTTP грешка (500) също връща празно', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    const r = await getVisionProvider().recognize('x');
    expect(r.fields.serial).toBeNull();
  });

  it('при успех подава реалните полета (demo=false)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        fields: { brand: 'Gloria', model: 'P6', serial: 'AB12', year: 2022, type: 'powder_abc', capacityKg: 6, agent: null, stamps: [], scrapYear: null },
        confidence: 0.9, raw: 'Brand: Gloria',
      }),
    })));
    const r = await getVisionProvider().recognize('x');
    expect(r.demo).toBe(false);
    expect(r.fields.serial).toBe('AB12');
    expect(r.confidence).toBe(0.9);
  });
});
