import { describe, it, expect } from 'vitest';
import { buildMarkings } from './markings';
import { draftToLine, emptyDraft, small1kgDefaults, stdMass } from './draft';

describe('buildMarkings', () => {
  it('сглобява от марка+клас+капацитет когато няма модел', () => {
    expect(buildMarkings({ brand: 'Огнехром', type: 'powder_abc', capacity: '2', serial: 'ABC-1001', year: '2014' }))
      .toBe('Огнехром ABC 2 кг № ABC-1001 / 2014');
  });
  it('воден → клас W и единица л', () => {
    expect(buildMarkings({ brand: 'Chubb', type: 'water', capacity: '9', serial: 'W-1013', year: '2013' }))
      .toBe('Chubb W 9 л № W-1013 / 2013');
  });
  it('марката е водеща (формат като образеца), моделът се пренебрегва', () => {
    expect(buildMarkings({ brand: 'Спарк', model: 'нещо', type: 'powder_abc', capacity: '6', serial: '0036', year: '2022' }))
      .toBe('Спарк ABC 6 кг № 0036 / 2022');
  });
  it('ползва модела само когато няма марка', () => {
    expect(buildMarkings({ model: 'Спарк 6 кг', type: 'powder_abc', capacity: '6', serial: '0036', year: '2022' }))
      .toBe('Спарк 6 кг № 0036 / 2022');
  });
});

describe('draftToLine', () => {
  it('ТО → без търговско наименование; форматира маса и дата', () => {
    const d = { ...emptyDraft('1'), brand: 'Спарк', type: 'powder_abc', cap: '6', serial: '0036', year: '2022', category: 'К2', totalMass: '9,5', action: 'TO', date: '2026-06-16', tech: 'Х. Христов', sticker: '063482', agentTrade: 'няма' };
    const line = draftToLine(d, 1);
    expect(line.category).toBe('К2');
    expect(line.agent).toBe('Прах');
    expect(line.serviceKind).toBe('ТО');
    expect(line.agentTradeName).toBe('');     // ТО → празно
    expect(line.mass).toBe('9,500');
    expect(line.serviceDate).toBe('16.06.2026');
    expect(line.stickerNo).toBe('063482');
  });
  it('презареждане (стара стойност) → ТО + ПЗ + търговско наименование', () => {
    const d = { ...emptyDraft('2'), type: 'powder_abc', action: 'recharge', agentTrade: 'Кобра ABC 50' };
    const line = draftToLine(d, 2);
    expect(line.serviceKind).toBe('ТО + ПЗ');
    expect(line.agentTradeName).toBe('Кобра ABC 50');
  });
  it('графа 7 — нови комбинации (ред ТО→ХИ→ПЗ, „ПЗ" не „П")', () => {
    expect(draftToLine({ ...emptyDraft('3'), action: 'TO_HI_PZ', agentTrade: 'AFFF' }, 3).serviceKind).toBe('ТО + ХИ + ПЗ');
    expect(draftToLine({ ...emptyDraft('4'), action: 'TO_HI', agentTrade: 'вода' }, 4).serviceKind).toBe('ТО + ХИ');
    expect(draftToLine({ ...emptyDraft('5'), action: 'TO' }, 5).serviceKind).toBe('ТО');
    expect(draftToLine({ ...emptyDraft('6'), action: 'TO_HI', agentTrade: 'X' }, 6).agentTradeName).toBe('X');
  });
});

describe('stdMass', () => {
  it('стандартни тегла (бруто) по вид + капацитет', () => {
    expect(stdMass('powder_abc', '6')).toBe('9,5');
    expect(stdMass('co2', '5')).toBe('14,0');
    expect(stdMass('water', '9')).toBe('13,5');
    expect(stdMass('powder_abc', '999')).toBe('');
  });
});

describe('small1kgDefaults', () => {
  it('1 кг прахов без данни → авто 4-цифрен сериен + скорошна година + марка „прахов"', () => {
    const r = small1kgDefaults({ ...emptyDraft('1'), type: 'powder_abc', cap: '1' });
    expect(r.serial).toMatch(/^\d{4}$/);
    expect(['2019', '2020']).toContain(r.year);
    expect(r.brand).toBe('прахов');
  });
  it('над 1 кг → НЕ генерира (серийният остава празен)', () => {
    const r = small1kgDefaults({ ...emptyDraft('2'), type: 'powder_abc', cap: '6' });
    expect(r.serial).toBe('');
    expect(r.brand).toBe('');
  });
  it('пази вече въведените стойности', () => {
    const r = small1kgDefaults({ ...emptyDraft('3'), type: 'powder_abc', cap: '1', serial: 'ABC-1', year: '2015', brand: 'Спарк' });
    expect(r.serial).toBe('ABC-1'); expect(r.year).toBe('2015'); expect(r.brand).toBe('Спарк');
  });
});
