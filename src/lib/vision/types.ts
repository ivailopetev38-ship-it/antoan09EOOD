import type { ExtinguisherType } from '@/lib/regulatory/types';

export interface StickerFields {
  brand: string | null;
  model: string | null;
  serial: string | null;
  year: number | null;
  type: ExtinguisherType | null;
  capacityKg: number | null;
  agent: string | null;
  stamps: { kind: 'TO' | 'recharge' | 'HI'; date: string }[];
  scrapYear: number | null;
}

export interface RecognizeResult {
  fields: StickerFields;
  confidence: number;
  demo: boolean;
  raw?: string;
}

export interface VisionProvider {
  recognize(imageBase64: string, effort?: 'high'): Promise<RecognizeResult>;
}
