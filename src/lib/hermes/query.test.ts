import { describe, it, expect } from 'vitest';
import { classifyIntent, parseAction, parseWithinDays, parseSite, extractSerial } from './query';

describe('classifyIntent', () => {
  it('история', () => {
    expect(classifyIntent('Покажи историята на сериен 5487')).toBe('history');
  });
  it('дължими', () => {
    expect(classifyIntent('Кои на обект Складове Дунав са за ХИ до 30 дни?')).toBe('due');
  });
  it('брак', () => {
    expect(classifyIntent('Колко са за брак тази седмица?')).toBe('count_scrap');
  });
  it('търсене (по подразбиране)', () => {
    expect(classifyIntent('Спарк 0036')).toBe('search');
  });
});

describe('parseAction', () => {
  it('ХИ', () => expect(parseAction('за ХИ до 30 дни')).toBe('HI'));
  it('презареждане', () => expect(parseAction('за презареждане')).toBe('recharge'));
  it('ТО', () => expect(parseAction('техническо обслужване')).toBe('TO'));
  it('няма', () => expect(parseAction('Спарк 0036')).toBeUndefined());
});

describe('parseWithinDays', () => {
  it('до 30 дни', () => expect(parseWithinDays('до 30 дни')).toBe(30));
  it('няма', () => expect(parseWithinDays('за ХИ')).toBeUndefined());
});

describe('parseSite', () => {
  it('извлича име на обект', () => {
    expect(parseSite('Кои на обект Складове Дунав са за ХИ до 30 дни?')).toBe('Складове Дунав');
  });
});

describe('extractSerial', () => {
  it('след „сериен"', () => expect(extractSerial('история на сериен 5487')).toBe('5487'));
  it('fallback към токен с цифра', () => expect(extractSerial('Спарк 0036')).toBe('0036'));
});
