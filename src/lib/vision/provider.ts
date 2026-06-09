import type { VisionProvider, RecognizeResult } from './types';

// Канонично демо — ползва се САМО когато Hermes изобщо не е конфигуриран (локален преглед).
const DEMO: RecognizeResult = {
  demo: true,
  confidence: 0.66,
  fields: {
    brand: 'Sparky',
    model: 'Спарк 6 кг',
    serial: '0036',
    year: 2022,
    type: 'powder_abc',
    capacityKg: 6,
    agent: 'Кобра ABC 50',
    stamps: [
      { kind: 'TO', date: '2025-12-01' },
      { kind: 'recharge', date: '2025-12-01' },
    ],
    scrapYear: 2037,
  },
};

// При неуспех/грешка от Hermes връщаме ПРАЗЕН резултат (без фалшив сериен №),
// за да няма лъжливо съвпадение с реален гасител. UI-то показва „не разчетено — въведи ръчно".
const UNRECOGNIZED: RecognizeResult = {
  demo: true,
  confidence: 0,
  fields: {
    brand: null, model: null, serial: null, year: null,
    type: null, capacityKg: null, agent: null, stamps: [], scrapYear: null,
  },
};

function hermesProvider(url: string, token: string): VisionProvider {
  return {
    async recognize(imageBase64: string): Promise<RecognizeResult> {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ imageBase64, task: 'extinguisher_sticker', schemaVersion: 1 }),
        });
        if (!res.ok) throw new Error(`Hermes vision ${res.status}`);
        const json = (await res.json()) as {
          fields?: RecognizeResult['fields'];
          confidence?: number;
          raw?: string;
        };
        if (!json.fields) throw new Error('Hermes vision: no fields');
        return { fields: json.fields, confidence: json.confidence ?? 0.8, demo: false, raw: json.raw };
      } catch {
        // Грациозен fallback: при мрежова грешка/таймаут НЕ фабрикуваме сериен №
        // (иначе случайна снимка би „съвпаднала" с реален гасител). Връщаме празно.
        return UNRECOGNIZED;
      }
    },
  };
}

function fallbackProvider(): VisionProvider {
  return {
    async recognize(): Promise<RecognizeResult> {
      return DEMO;
    },
  };
}

export function getVisionProvider(): VisionProvider {
  const url = process.env.HERMES_VISION_URL;
  const token = process.env.HERMES_API_TOKEN ?? '';
  return url ? hermesProvider(url, token) : fallbackProvider();
}
