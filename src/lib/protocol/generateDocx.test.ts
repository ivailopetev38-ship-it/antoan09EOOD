import { describe, it, expect } from 'vitest';
import PizZip from 'pizzip';
import { generateProtocolDocx } from './generateDocx';
import type { ProtocolData } from './types';

const sample: ProtocolData = {
  protocolNo: '55/2026',
  date: '03.06.2026',
  city: 'Нова Загора',
  ownerName: 'ЕТ Демо Клиент',
  ownerAddress: 'гр. Нова Загора, ул. Демо 1',
  ownerPhone: '0888000111',
  lines: [{
    idx: 1, markings: 'Прахов 1 кг № 5487 / 2019', category: 'К2', mass: '1,600',
    agent: 'Прах', agentTradeName: '', serviceKind: 'ТО', serviceDate: '27.05.2026',
    technicianName: 'Х. Христов', stickerNo: '0615',
  }],
};

describe('generateProtocolDocx', () => {
  it('връща .docx, попълнен с подадените данни', () => {
    const buf = generateProtocolDocx(sample);
    const xml = new PizZip(buf).file('word/document.xml')!.asText();
    expect(xml).toContain('5487');
    expect(xml).toContain('0615');
    expect(xml).toContain('Христов');
    expect(xml).toContain('55/2026');
  });
});
