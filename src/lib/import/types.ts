import type { ExtinguisherType } from '@/lib/regulatory/types';

export interface ParsedRow {
  client: string;
  site: string;
  brand: string | null;
  model: string | null;
  type: ExtinguisherType;
  serial: string;
  year: number;
  stampYear: number | null;
  massKg: number | null;
  grossMassKg: number | null;
  category: string | null;
  lastTO: string | null;
  lastRecharge: string | null;
  lastHI: string | null;
  technician: string | null;
  notes: string | null;
}

export interface ImportError {
  line: number; // номер на ред в текста (1-базиран, вкл. хедъра)
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: ImportError[];
}
