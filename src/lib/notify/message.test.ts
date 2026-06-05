import { describe, it, expect } from 'vitest';
import { composeReminder } from './message';

describe('composeReminder', () => {
  it('предстоящо ХИ', () => {
    const t = composeReminder({
      clientName: 'ЕТ Орлов',
      siteName: 'Складове Дунав',
      model: 'Спарк 6 кг',
      serial: '0036',
      action: 'HI',
      nextDue: '2026-07-01',
      overdue: false,
    });
    expect(t).toMatch(/Предстои/);
    expect(t).toMatch(/хидростатично/i);
    expect(t).toMatch(/01\.07\.2026/);
    expect(t).toMatch(/0036/);
  });
  it('просрочено ТО', () => {
    const t = composeReminder({
      clientName: 'ЕТ Орлов',
      siteName: 'Дунав',
      model: null,
      serial: 'P-441',
      action: 'TO',
      nextDue: '2026-01-10',
      overdue: true,
    });
    expect(t).toMatch(/Просрочено/);
    expect(t).toMatch(/техническо/i);
  });
});
