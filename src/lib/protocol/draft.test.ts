import { describe, it, expect } from 'vitest';
import { buildMarkings } from './markings';
import { draftToLine, emptyDraft } from './draft';

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
  it('презареждане → включва търговско наименование', () => {
    const d = { ...emptyDraft('2'), type: 'powder_abc', action: 'recharge', agentTrade: 'Кобра ABC 50' };
    const line = draftToLine(d, 2);
    expect(line.serviceKind).toBe('П');
    expect(line.agentTradeName).toBe('Кобра ABC 50');
  });
});
