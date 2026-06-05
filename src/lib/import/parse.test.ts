import { describe, it, expect } from 'vitest';
import { parseImport } from './parse';

const HEADER =
  'клиент\tобект\tмарка\tмодел\tсериен\tтип\tкапацитет\tгодина\tщампа\tпоследно_ТО\tпоследно_ПЗ\tпоследно_ХИ\tтехник\tзабележки';

describe('parseImport', () => {
  it('парсва валиден TSV ред', () => {
    const text = `${HEADER}\nЕТ Орлов\tСкладове Дунав\tSparky\tСпарк 6 кг\t0036\tпрахов ABC\t6 кг\t2022\t2037\t01.12.2025\t01.12.2025\t\tП. Петров\t`;
    const r = parseImport(text);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      client: 'ЕТ Орлов',
      site: 'Складове Дунав',
      brand: 'Sparky',
      model: 'Спарк 6 кг',
      type: 'powder_abc',
      serial: '0036',
      year: 2022,
      stampYear: 2037,
      massKg: 6,
      lastTO: '2025-12-01',
      lastRecharge: '2025-12-01',
      lastHI: null,
      technician: 'П. Петров',
    });
  });

  it('поддържа разделител ; и празни клетки', () => {
    const text = `клиент;обект;сериен;тип;година\nЕТ Орлов;Дунав;0099;воден;2024`;
    const r = parseImport(text);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({
      client: 'ЕТ Орлов',
      site: 'Дунав',
      serial: '0099',
      type: 'water',
      year: 2024,
    });
  });

  it('дава грешка при липсващо задължително поле', () => {
    const text = `клиент\tобект\tсериен\tтип\tгодина\n\tДунав\t0036\tпрахов ABC\t2022`;
    const r = parseImport(text);
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0].line).toBe(2);
    expect(r.errors[0].message).toMatch(/клиент/i);
  });

  it('дава грешка при непознат тип', () => {
    const text = `клиент\tобект\tсериен\tтип\tгодина\nЕТ\tДунав\t0036\tнещо\t2022`;
    const r = parseImport(text);
    expect(r.errors[0].message).toMatch(/тип/i);
  });

  it('празен вход → 0 реда, 0 грешки', () => {
    expect(parseImport('')).toEqual({ rows: [], errors: [] });
    expect(parseImport('   \n  ')).toEqual({ rows: [], errors: [] });
  });
});
