import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import type { ProtocolData } from './types';

const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'predavatelen-protokol.docx');

export function generateProtocolDocx(data: ProtocolData): Buffer {
  const content = fs.readFileSync(TEMPLATE_PATH, 'binary');
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
  });
  // Стойности по подразбиране за подписите (важат за всички пътища: кошница, build.ts, имейл).
  const full = {
    ...data,
    handedBy: (data.handedBy && data.handedBy.trim()) || 'В. Вълков',
    receivedBy: (data.receivedBy && data.receivedBy.trim()) || data.ownerName,
  };
  doc.render(full);
  return doc.getZip().generate({ type: 'nodebuffer' });
}
