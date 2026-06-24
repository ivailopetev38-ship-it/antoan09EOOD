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
  // Подписи: уважаваме ТОЧНО подаденото. undefined (липсващо поле, напр. build.ts) → подразбиране;
  // '' (изрично изчистено от потребителя) → ОСТАВА празно (без скрит fallback към „В. Вълков"/собственик).
  const full = {
    ...data,
    handedBy: data.handedBy === undefined ? 'В. Вълков' : data.handedBy,
    receivedBy: data.receivedBy === undefined ? data.ownerName : data.receivedBy,
  };
  doc.render(full);
  return doc.getZip().generate({ type: 'nodebuffer' });
}
