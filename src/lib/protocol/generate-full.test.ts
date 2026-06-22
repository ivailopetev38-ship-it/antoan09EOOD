import { describe, it, expect } from 'vitest';
import PizZip from 'pizzip';
import { generateProtocolDocx } from './generateDocx';
import { draftToLine, type LineDraft } from './draft';
import type { ProtocolData } from './types';

/** Извлича чистия текст от word/document.xml (маха таговете), за да търсим стойности по графи. */
function plainText(buffer: Buffer): string {
  const zip = new PizZip(buffer);
  const xml = zip.file('word/document.xml')!.asText();
  return xml.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

const d = (o: Partial<LineDraft>): LineDraft => ({
  id: 'x', brand: '', model: '', serial: '', year: '', type: 'powder_abc', cap: '',
  category: 'К2', totalMass: '', action: 'TO', agentTrade: '', date: '2026-06-20',
  sticker: '', tech: 'Х. Христов', ...o,
});

// По един ред за всеки вид гасител + всеки вид дейност (ТО/презареждане/ХИ),
// плюс резервната маркировка по модел (ред 4 — без марка).
const drafts: LineDraft[] = [
  d({ brand: 'Огнехром', type: 'powder_abc', cap: '2', category: 'К2', totalMass: '3,5',  action: 'TO',       serial: 'S1', year: '2014', sticker: '1001' }),
  d({ brand: 'Бавария',  type: 'powder_bc',  cap: '6', category: 'К3', totalMass: '9,5',  action: 'recharge', agentTrade: 'Прах ABC ICL', serial: 'S2', year: '2018', sticker: '1002' }),
  d({ brand: 'Chubb',    type: 'water',      cap: '9', category: 'К1', totalMass: '12',   action: 'HI',       agentTrade: 'Вода питейна',  serial: 'S3', year: '2013', sticker: '1003' }),
  d({ model: 'Пяна-спец', type: 'foam',      cap: '9', category: 'К1', totalMass: '11',   action: 'TO',       serial: 'S4', year: '2017', sticker: '1004' }),
  d({ brand: 'Mygt',     type: 'co2',        cap: '5', category: 'К4', totalMass: '14',   action: 'recharge', agentTrade: 'CO2 99,9%',     serial: 'S5', year: '2020', sticker: '1005' }),
];
const lines = drafts.map((x, i) => draftToLine(x, i + 1));
const data: ProtocolData = {
  protocolNo: '42/2026', date: '20.06.2026', city: 'Нова Загора',
  ownerName: 'Тест Клиент ЕООД', ownerAddress: 'ул. Тест 1', ownerPhone: '0888 000 000',
  lines,
};
const text = plainText(generateProtocolDocx(data));

describe('Мапване LineDraft → графи (точни стойности)', () => {
  it('ред 1 — прах ABC, ТО (без търговско наименование)', () => {
    expect(lines[0]).toMatchObject({
      markings: 'Огнехром ABC 2 кг № S1 / 2014', category: 'К2', mass: '3,500',
      agent: 'Прах', agentTradeName: '', serviceKind: 'ТО', serviceDate: '20.06.2026',
      technicianName: 'Х. Христов', stickerNo: '1001',
    });
  });
  it('ред 2 — прах BC, презареждане (с търговско наименование)', () => {
    expect(lines[1]).toMatchObject({
      markings: 'Бавария BC 6 кг № S2 / 2018', mass: '9,500', agent: 'Прах',
      serviceKind: 'П', agentTradeName: 'Прах ABC ICL',
    });
  });
  it('ред 3 — вода (единица „л"), ХИ', () => {
    expect(lines[2]).toMatchObject({
      markings: 'Chubb W 9 л № S3 / 2013', mass: '12,000', agent: 'Вода',
      serviceKind: 'ХИ', agentTradeName: 'Вода питейна',
    });
  });
  it('ред 4 — пяна, резервна маркировка по модел, ТО (без търговско)', () => {
    expect(lines[3]).toMatchObject({
      markings: 'Пяна-спец № S4 / 2017', mass: '11,000', agent: 'Пяна',
      serviceKind: 'ТО', agentTradeName: '',
    });
  });
  it('ред 5 — CO2, презареждане', () => {
    expect(lines[4]).toMatchObject({
      markings: 'Mygt CO2 5 кг № S5 / 2020', mass: '14,000', agent: 'CO2',
      serviceKind: 'П', agentTradeName: 'CO2 99,9%',
    });
  });
});

describe('Рендер в Word (.docx) — всяка графа присъства в документа', () => {
  it('гр.2 маркировки — формат като образеца (клас + единици кг/л)', () => {
    expect(text).toContain('Огнехром ABC 2 кг № S1 / 2014');
    expect(text).toContain('Бавария BC 6 кг № S2 / 2018');
    expect(text).toContain('Chubb W 9 л № S3 / 2013');
    expect(text).toContain('Пяна-спец № S4 / 2017');
    expect(text).toContain('Mygt CO2 5 кг № S5 / 2020');
  });
  it('гр.4 обща маса — формат "x,xxx"', () => {
    for (const m of ['3,500', '9,500', '12,000', '11,000', '14,000']) expect(text).toContain(m);
  });
  it('гр.6 търговско наименование — само при презареждане/ХИ', () => {
    for (const t of ['Прах ABC ICL', 'Вода питейна', 'CO2 99,9%']) expect(text).toContain(t);
  });
  it('гр.3 категория, гр.8 дата, гр.11 стикер', () => {
    for (const c of ['К2', 'К3', 'К1', 'К4']) expect(text).toContain(c);
    expect(text).toContain('20.06.2026');
    for (const s of ['1001', '1002', '1003', '1004', '1005']) expect(text).toContain(s);
  });
  it('шапка + собственик', () => {
    expect(text).toContain('ПРОТОКОЛ № 42/2026');
    expect(text).toContain('Тест Клиент ЕООД');
  });
  it('точно 5 реда са рендирани (техник по веднъж на ред)', () => {
    expect((text.match(/Х\. Христов/g) || []).length).toBe(5);
    for (const s of ['№ S1', '№ S2', '№ S3', '№ S4', '№ S5']) expect(text).toContain(s);
  });
});
