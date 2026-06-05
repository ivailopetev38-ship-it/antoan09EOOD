# Антоан-09 Демо-кръг 2 · Фаза 1: Данни + импорт — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Зареди пълната номенклатура от ТЗ (вещества) и добави импорт-механизъм, та реалната база с пожарогасители да се качи на 1 клик щом дойде.

**Architecture:** Чист, тестван парсер (TSV/CSV → нормализирани редове) + тънък DB слой (upsert през `createServiceClient`) + API route + проста админ страница. Парсването и нормализацията са pure функции (Vitest). Каталогът „вещества" е нова таблица, seed-ната от ТЗ; марките вече са seed-нати.

**Tech Stack:** Next.js 16 (App Router, route handlers), TypeScript, Supabase (Postgres, service_role), Vitest 4.

**Спец:** `docs/superpowers/specs/2026-06-05-antoan09-demo-round2-design.md` (Компонент 1).

**Бележки за съществуващия код (референция, не предполагай):**
- DB клиент: `src/lib/supabase/server.ts` → `createServiceClient()`.
- Схема: `supabase/migrations/0001_init.sql`. Таблици: `brands(id,name unique)`, `clients(id,name,address,phone,eik)`, `sites(id,client_id,name,address)`, `extinguishers(id,site_id,brand_id,model,type,serial_number,manufacture_year,category,mass_kg,stamp_year)`, `service_events(id,extinguisher_id,kind,service_date,technician_name,agent_trade_name,notes)`.
- Enum `extinguisher_type`: `powder_abc | powder_bc | water | foam | co2`.
- Enum `service_kind`: `TO | recharge | powder_change | foam_change | HI`.
- Марките са seed-нати в `supabase/seed.sql` (17 бр.).
- Pattern за API route: виж `src/app/api/hermes/search/route.ts` (използва `export const dynamic = 'force-dynamic'`, `NextResponse`). **Следвай този pattern, не training-data предположения** (виж AGENTS.md).
- Тестове: до файла, `*.test.ts`, `npx vitest run <path>`.

---

## File Structure

- Create: `supabase/migrations/0003_agents_catalog.sql` — таблица `agents` + seed.
- Modify: `supabase/seed.sql` — добави seed на `agents` (за локални/нови среди).
- Create: `src/lib/import/types.ts` — `ParsedRow`, `ImportError`, `ParseResult`.
- Create: `src/lib/import/parse.ts` — `parseImport(text)` (pure).
- Create: `src/lib/import/parse.test.ts` — тестове за парсера.
- Create: `src/lib/import/normalize.ts` — `normalizeType`, `parseYear`, `parseFlexDate`, `parseNumber` (pure).
- Create: `src/lib/import/normalize.test.ts` — тестове за нормализацията.
- Create: `src/lib/import/apply.ts` — `applyImport(rows)` (DB upsert; integration).
- Create: `src/app/api/import/route.ts` — `POST` { text } → резюме.
- Create: `src/app/admin/import/page.tsx` — textarea + бутон + резултат.

---

## Task 1: Каталог „вещества" (agents)

**Files:**
- Create: `supabase/migrations/0003_agents_catalog.sql`
- Modify: `supabase/seed.sql` (добави в края)

- [ ] **Step 1: Напиши миграцията**

Create `supabase/migrations/0003_agents_catalog.sql`:

```sql
-- Каталог гасителни вещества (по ТЗ т.4) — разширяем
create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('powder','foam','water','co2')),
  trade_name text not null,
  unique (kind, trade_name)
);

insert into agents (kind, trade_name) values
 ('powder','Кобра ABC 50'),
 ('powder','Верея ABC 40'),
 ('foam','Щамекс FF'),
 ('water','Вода'),
 ('co2','CO2')
on conflict (kind, trade_name) do nothing;
```

- [ ] **Step 2: Приложи миграцията към Supabase**

Приложи чрез Supabase MCP `apply_migration` (name: `0003_agents_catalog`, query = съдържанието по-горе).
Очаквано: успех, без грешка.

- [ ] **Step 3: Провери таблицата**

Чрез Supabase MCP `execute_sql`: `select kind, trade_name from agents order by kind, trade_name;`
Очаквано: 5 реда (co2, foam, powder×2, water).

- [ ] **Step 4: Добави seed-а и в seed.sql (за нови среди)**

Добави в края на `supabase/seed.sql`:

```sql

-- Каталог гасителни вещества
insert into agents (kind, trade_name) values
 ('powder','Кобра ABC 50'),
 ('powder','Верея ABC 40'),
 ('foam','Щамекс FF'),
 ('water','Вода'),
 ('co2','CO2')
on conflict (kind, trade_name) do nothing;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_agents_catalog.sql supabase/seed.sql
git commit -m "feat(data): agents catalog table + seed (ТЗ т.4)"
```

---

## Task 2: Нормализация (pure helpers, TDD)

**Files:**
- Create: `src/lib/import/normalize.ts`
- Test: `src/lib/import/normalize.test.ts`

- [ ] **Step 1: Напиши failing тестовете**

Create `src/lib/import/normalize.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeType, parseYear, parseFlexDate, parseNumber } from './normalize';

describe('normalizeType', () => {
  it('разпознава прахов ABC', () => {
    expect(normalizeType('прахов ABC')).toBe('powder_abc');
    expect(normalizeType('прах abc')).toBe('powder_abc');
  });
  it('разпознава прахов BC', () => {
    expect(normalizeType('прахов BC')).toBe('powder_bc');
  });
  it('разпознава воден/водопенен/CO2', () => {
    expect(normalizeType('воден')).toBe('water');
    expect(normalizeType('вода')).toBe('water');
    expect(normalizeType('водопенен')).toBe('foam');
    expect(normalizeType('пяна')).toBe('foam');
    expect(normalizeType('CO2')).toBe('co2');
    expect(normalizeType('въглероден диоксид')).toBe('co2');
  });
  it('връща null при непознат тип', () => {
    expect(normalizeType('нещо')).toBeNull();
    expect(normalizeType('')).toBeNull();
  });
});

describe('parseYear', () => {
  it('чете 4-цифрена година', () => {
    expect(parseYear('2019')).toBe(2019);
    expect(parseYear(' 2024 ')).toBe(2024);
  });
  it('връща null при невалидна', () => {
    expect(parseYear('19')).toBeNull();
    expect(parseYear('')).toBeNull();
    expect(parseYear('abcd')).toBeNull();
  });
});

describe('parseFlexDate', () => {
  it('чете dd.mm.yyyy → ISO', () => {
    expect(parseFlexDate('27.05.2026')).toBe('2026-05-27');
    expect(parseFlexDate('1.6.2025')).toBe('2025-06-01');
  });
  it('приема ISO както е', () => {
    expect(parseFlexDate('2025-12-01')).toBe('2025-12-01');
  });
  it('празно → null', () => {
    expect(parseFlexDate('')).toBeNull();
    expect(parseFlexDate('  ')).toBeNull();
  });
});

describe('parseNumber', () => {
  it('чете число с единица и запетая', () => {
    expect(parseNumber('6 кг')).toBe(6);
    expect(parseNumber('9 л')).toBe(9);
    expect(parseNumber('1,600')).toBeCloseTo(1.6);
    expect(parseNumber('50')).toBe(50);
  });
  it('празно → null', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('-')).toBeNull();
  });
});
```

- [ ] **Step 2: Пусни тестовете — да паднат**

Run: `npx vitest run src/lib/import/normalize.test.ts`
Expected: FAIL ("Cannot find module './normalize'").

- [ ] **Step 3: Имплементирай normalize.ts**

Create `src/lib/import/normalize.ts`:

```ts
import type { ExtinguisherType } from '@/lib/regulatory/types';

export function normalizeType(raw: string): ExtinguisherType | null {
  const t = ` ${raw.toLowerCase().trim()} `;
  if (!t.trim()) return null;
  if (/со2|co2|въглерод/.test(t)) return 'co2';
  if (/водопен|пяна|пенопен|foam/.test(t)) return 'foam';
  if (/вод|water/.test(t)) return 'water';
  if (/прах|powder/.test(t)) {
    if (/\bbc\b|\sbc\s|бц/.test(t)) return 'powder_bc';
    return 'powder_abc';
  }
  return null;
}

export function parseYear(raw: string): number | null {
  const m = /\b(\d{4})\b/.exec(raw.trim());
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1950 && y <= 2100 ? y : null;
}

export function parseFlexDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return s;
  const bg = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (bg) {
    const d = bg[1].padStart(2, '0');
    const m = bg[2].padStart(2, '0');
    return `${bg[3]}-${m}-${d}`;
  }
  return null;
}

export function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  const m = /-?\d+(\.\d+)?/.exec(s);
  if (!m) return null;
  return Number(m[0]);
}
```

- [ ] **Step 4: Пусни тестовете — да минат**

Run: `npx vitest run src/lib/import/normalize.test.ts`
Expected: PASS (всички).

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/normalize.ts src/lib/import/normalize.test.ts
git commit -m "feat(import): pure normalize helpers (type/year/date/number) + tests"
```

---

## Task 3: Типове + парсер (pure, TDD)

**Files:**
- Create: `src/lib/import/types.ts`
- Create: `src/lib/import/parse.ts`
- Test: `src/lib/import/parse.test.ts`

- [ ] **Step 1: Дефинирай типовете**

Create `src/lib/import/types.ts`:

```ts
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
  lastTO: string | null;
  lastRecharge: string | null;
  lastHI: string | null;
  technician: string | null;
  notes: string | null;
}

export interface ImportError {
  line: number;     // номер на ред в текста (1-базиран, вкл. хедъра)
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: ImportError[];
}
```

- [ ] **Step 2: Напиши failing тестовете**

Create `src/lib/import/parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseImport } from './parse';

const HEADER = 'клиент\tобект\tмарка\tмодел\tсериен\tтип\tкапацитет\tгодина\tщампа\tпоследно_ТО\tпоследно_ПЗ\tпоследно_ХИ\tтехник\tзабележки';

describe('parseImport', () => {
  it('парсва валиден TSV ред', () => {
    const text = `${HEADER}\nЕТ Орлов\tСкладове Дунав\tSparky\tСпарк 6 кг\t0036\tпрахов ABC\t6 кг\t2022\t2037\t01.12.2025\t01.12.2025\t\tП. Петров\t`;
    const r = parseImport(text);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      client: 'ЕТ Орлов', site: 'Складове Дунав', brand: 'Sparky',
      model: 'Спарк 6 кг', type: 'powder_abc', serial: '0036',
      year: 2022, stampYear: 2037, massKg: 6,
      lastTO: '2025-12-01', lastRecharge: '2025-12-01', lastHI: null,
      technician: 'П. Петров',
    });
  });

  it('поддържа разделител ; и празни клетки', () => {
    const text = `клиент;обект;сериен;тип;година\nЕТ Орлов;Дунав;0099;воден;2024`;
    const r = parseImport(text);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ client: 'ЕТ Орлов', site: 'Дунав', serial: '0099', type: 'water', year: 2024 });
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
```

- [ ] **Step 3: Пусни тестовете — да паднат**

Run: `npx vitest run src/lib/import/parse.test.ts`
Expected: FAIL ("Cannot find module './parse'").

- [ ] **Step 4: Имплементирай parse.ts**

Create `src/lib/import/parse.ts`:

```ts
import { normalizeType, parseYear, parseFlexDate, parseNumber } from './normalize';
import type { ParsedRow, ParseResult, ImportError } from './types';

// синоними на колони → вътрешен ключ
const COLS: Record<string, string> = {
  'клиент': 'client', 'обект': 'site', 'марка': 'brand', 'модел': 'model',
  'сериен': 'serial', 'сериен №': 'serial', 'сериен номер': 'serial',
  'тип': 'type', 'вид': 'type', 'капацитет': 'capacity', 'маса': 'capacity',
  'година': 'year', 'щампа': 'stamp', 'щампа-година': 'stamp',
  'последно_то': 'lastTO', 'последно то': 'lastTO',
  'последно_пз': 'lastRecharge', 'последно пз': 'lastRecharge',
  'последно_хи': 'lastHI', 'последно хи': 'lastHI',
  'техник': 'technician', 'забележки': 'notes', 'забележка': 'notes',
};

function detectDelimiter(line: string): string {
  if (line.includes('\t')) return '\t';
  if (line.includes(';')) return ';';
  return ',';
}

function clean(s: string | undefined): string {
  return (s ?? '').trim();
}

export function parseImport(text: string): ParseResult {
  const lines = text.split(/\r?\n/).map((l) => l).filter((l) => l.trim() !== '');
  if (lines.length < 2) return { rows: [], errors: [] };

  const delim = detectDelimiter(lines[0]);
  const headerKeys = lines[0].split(delim).map((h) => COLS[h.trim().toLowerCase()] ?? '');

  const rows: ParsedRow[] = [];
  const errors: ImportError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim);
    const rec: Record<string, string> = {};
    headerKeys.forEach((key, idx) => { if (key) rec[key] = clean(cells[idx]); });

    const lineNo = i + 1; // 1-базиран, хедърът е ред 1
    const missing: string[] = [];
    if (!rec.client) missing.push('клиент');
    if (!rec.site) missing.push('обект');
    if (!rec.serial) missing.push('сериен');
    if (missing.length) {
      errors.push({ line: lineNo, message: `Липсва: ${missing.join(', ')}` });
      continue;
    }
    const type = normalizeType(rec.type ?? '');
    if (!type) {
      errors.push({ line: lineNo, message: `Непознат тип: „${rec.type ?? ''}"` });
      continue;
    }
    const year = parseYear(rec.year ?? '');
    if (!year) {
      errors.push({ line: lineNo, message: `Невалидна година: „${rec.year ?? ''}"` });
      continue;
    }
    rows.push({
      client: rec.client,
      site: rec.site,
      brand: rec.brand || null,
      model: rec.model || null,
      type,
      serial: rec.serial,
      year,
      stampYear: parseYear(rec.stamp ?? ''),
      massKg: parseNumber(rec.capacity ?? ''),
      lastTO: parseFlexDate(rec.lastTO ?? ''),
      lastRecharge: parseFlexDate(rec.lastRecharge ?? ''),
      lastHI: parseFlexDate(rec.lastHI ?? ''),
      technician: rec.technician || null,
      notes: rec.notes || null,
    });
  }
  return { rows, errors };
}
```

- [ ] **Step 5: Пусни тестовете — да минат**

Run: `npx vitest run src/lib/import/parse.test.ts`
Expected: PASS (всички).

- [ ] **Step 6: Commit**

```bash
git add src/lib/import/types.ts src/lib/import/parse.ts src/lib/import/parse.test.ts
git commit -m "feat(import): TSV/CSV parser → typed rows + tests"
```

---

## Task 4: Прилагане към базата (DB upsert)

**Files:**
- Create: `src/lib/import/apply.ts`

(Integration слой — без unit тест; проверява се през route-а в Task 6.)

- [ ] **Step 1: Имплементирай apply.ts**

Create `src/lib/import/apply.ts`:

```ts
import { createServiceClient } from '@/lib/supabase/server';
import type { ParsedRow } from './types';

export interface ApplySummary {
  clients: number;
  sites: number;
  extinguishers: number;
  events: number;
}

/** Upsert на клиенти/обекти/гасители + начални service_events. Идемпотентно по (обект, сериен №). */
export async function applyImport(rows: ParsedRow[]): Promise<ApplySummary> {
  const db = createServiceClient();
  const summary: ApplySummary = { clients: 0, sites: 0, extinguishers: 0, events: 0 };

  const clientIds = new Map<string, string>();
  const siteIds = new Map<string, string>();
  const brandIds = new Map<string, string>();

  for (const r of rows) {
    // клиент (по име)
    let clientId = clientIds.get(r.client);
    if (!clientId) {
      const { data: existing } = await db.from('clients').select('id').eq('name', r.client).maybeSingle();
      if (existing?.id) clientId = existing.id;
      else {
        const { data: ins } = await db.from('clients').insert({ name: r.client }).select('id').single();
        clientId = ins!.id; summary.clients++;
      }
      clientIds.set(r.client, clientId!);
    }

    // обект (по име + клиент)
    const siteKey = `${clientId}|${r.site}`;
    let siteId = siteIds.get(siteKey);
    if (!siteId) {
      const { data: existing } = await db.from('sites').select('id').eq('client_id', clientId!).eq('name', r.site).maybeSingle();
      if (existing?.id) siteId = existing.id;
      else {
        const { data: ins } = await db.from('sites').insert({ client_id: clientId, name: r.site }).select('id').single();
        siteId = ins!.id; summary.sites++;
      }
      siteIds.set(siteKey, siteId!);
    }

    // марка (по име)
    let brandId: string | null = null;
    if (r.brand) {
      brandId = brandIds.get(r.brand) ?? null;
      if (!brandId) {
        const { data: existing } = await db.from('brands').select('id').eq('name', r.brand).maybeSingle();
        if (existing?.id) brandId = existing.id;
        else {
          const { data: ins } = await db.from('brands').insert({ name: r.brand }).select('id').single();
          brandId = ins!.id;
        }
        brandIds.set(r.brand, brandId!);
      }
    }

    // гасител (по обект + сериен №) — идемпотентно
    const { data: existingExt } = await db.from('extinguishers')
      .select('id').eq('site_id', siteId!).eq('serial_number', r.serial).maybeSingle();
    let extId = existingExt?.id as string | undefined;
    const extPayload = {
      site_id: siteId, brand_id: brandId, model: r.model, type: r.type,
      serial_number: r.serial, manufacture_year: r.year, mass_kg: r.massKg, stamp_year: r.stampYear,
    };
    if (extId) {
      await db.from('extinguishers').update(extPayload).eq('id', extId);
    } else {
      const { data: ins } = await db.from('extinguishers').insert(extPayload).select('id').single();
      extId = ins!.id; summary.extinguishers++;
    }

    // начални събития (само ако още няма за този гасител)
    const { count } = await db.from('service_events')
      .select('*', { count: 'exact', head: true }).eq('extinguisher_id', extId!);
    if (!count) {
      const evs: Array<{ extinguisher_id: string; kind: string; service_date: string; technician_name: string | null }> = [];
      if (r.lastTO) evs.push({ extinguisher_id: extId!, kind: 'TO', service_date: r.lastTO, technician_name: r.technician });
      if (r.lastRecharge) {
        const kind = r.type === 'foam' ? 'foam_change' : r.type.startsWith('powder') ? 'powder_change' : 'recharge';
        evs.push({ extinguisher_id: extId!, kind, service_date: r.lastRecharge, technician_name: r.technician });
      }
      if (r.lastHI) evs.push({ extinguisher_id: extId!, kind: 'HI', service_date: r.lastHI, technician_name: r.technician });
      if (evs.length) { await db.from('service_events').insert(evs); summary.events += evs.length; }
    }
  }
  return summary;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: без грешки.

- [ ] **Step 3: Commit**

```bash
git add src/lib/import/apply.ts
git commit -m "feat(import): DB apply (idempotent upsert of clients/sites/exts/events)"
```

---

## Task 5: API route `/api/import`

**Files:**
- Create: `src/app/api/import/route.ts`

- [ ] **Step 1: Имплементирай route-а** (следвай pattern от `src/app/api/hermes/search/route.ts`)

Create `src/app/api/import/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { parseImport } from '@/lib/import/parse';
import { applyImport } from '@/lib/import/apply';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Невалиден JSON' }, { status: 400 });
  }
  const text = body.text ?? '';
  const { rows, errors } = parseImport(text);
  if (!rows.length) {
    return NextResponse.json({ ok: false, parsed: 0, errors }, { status: 400 });
  }
  const summary = await applyImport(rows);
  return NextResponse.json({ ok: true, parsed: rows.length, errors, summary });
}
```

- [ ] **Step 2: Стартирай dev сървъра**

Run: `npm run dev` (в отделен терминал)

- [ ] **Step 3: Тествай с примерен ред (PowerShell)**

```powershell
$h = "клиент`tобект`tмарка`tмодел`tсериен`tтип`tкапацитет`tгодина`tщампа`tпоследно_ТО`tпоследно_ПЗ`tпоследно_ХИ`tтехник`tзабележки"
$r = "Тест Клиент`tТест Обект`tSparky`tСпарк 6 кг`tTST-001`tпрахов ABC`t6 кг`t2022`t2037`t01.12.2025`t`t`tП. Петров`t"
$body = @{ text = "$h`n$r" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3000/api/import -Method POST -ContentType 'application/json; charset=utf-8' -Body $body
```
Expected: `ok=True, parsed=1, summary` с поне `extinguishers=1`.

- [ ] **Step 4: Провери в базата (Supabase MCP `execute_sql`)**

`select c.name, s.name, e.serial_number from extinguishers e join sites s on s.id=e.site_id join clients c on c.id=s.client_id where e.serial_number='TST-001';`
Expected: 1 ред (Тест Клиент / Тест Обект / TST-001).

- [ ] **Step 5: Изтрий тестовия запис**

Supabase MCP `execute_sql`: `delete from clients where name='Тест Клиент';` (cascade трие обект/гасител/събития).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/import/route.ts
git commit -m "feat(import): POST /api/import (parse + apply)"
```

---

## Task 6: Админ страница `/admin/import`

**Files:**
- Create: `src/app/admin/import/page.tsx`

- [ ] **Step 1: Имплементирай страницата** (Client Component)

Create `src/app/admin/import/page.tsx`:

```tsx
'use client';
import { useState } from 'react';

const PLACEHOLDER = `клиент\tобект\tмарка\tмодел\tсериен\tтип\tкапацитет\tгодина\tщампа\tпоследно_ТО\tпоследно_ПЗ\tпоследно_ХИ\tтехник\tзабележки
ЕТ Орлов\tСкладове Дунав\tSparky\tСпарк 6 кг\t0036\tпрахов ABC\t6 кг\t2022\t2037\t01.12.2025\t01.12.2025\t\tП. Петров\t`;

interface ImportResp {
  ok: boolean; parsed?: number;
  errors?: { line: number; message: string }[];
  summary?: { clients: number; sites: number; extinguishers: number; events: number };
  error?: string;
}

export default function ImportPage() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<ImportResp | null>(null);

  async function submit() {
    setBusy(true); setResp(null);
    try {
      const r = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      setResp(await r.json());
    } catch {
      setResp({ ok: false, error: 'Грешка при заявката' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Импорт на пожарогасители</h1>
      <p style={{ opacity: 0.7, marginBottom: 16 }}>
        Постави таблица (копирана от Excel = табове, или CSV с „;"). Първият ред са заглавията.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={12}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, padding: 12 }}
      />
      <button onClick={submit} disabled={busy || !text.trim()} style={{ marginTop: 12, padding: '10px 20px' }}>
        {busy ? 'Импортиране…' : 'Импортирай'}
      </button>

      {resp && (
        <div style={{ marginTop: 20 }}>
          {resp.ok ? (
            <p style={{ color: 'green' }}>
              ✓ Импортирани {resp.parsed} реда — нови: клиенти {resp.summary?.clients},
              обекти {resp.summary?.sites}, гасители {resp.summary?.extinguishers}, събития {resp.summary?.events}.
            </p>
          ) : (
            <p style={{ color: 'crimson' }}>✗ {resp.error ?? 'Има грешки'}</p>
          )}
          {!!resp.errors?.length && (
            <ul style={{ color: 'crimson', marginTop: 8 }}>
              {resp.errors.map((e, i) => <li key={i}>Ред {e.line}: {e.message}</li>)}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Провери lint + build**

Run: `npm run lint && npm run build`
Expected: без грешки.

- [ ] **Step 3: Ръчен E2E (dev)**

Отвори `http://localhost:3000/admin/import`, постави примерния текст (вече е в placeholder, въведи го), натисни „Импортирай".
Expected: зелено резюме. После изтрий тестовите данни (виж Task 5 Step 5, ако е нужно).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/import/page.tsx
git commit -m "feat(import): admin import page (/admin/import)"
```

---

## Self-Review (от автора на плана)

- **Spec покритие (Компонент 1):** каталог вещества ✓ (Task 1); марки вече seed-нати ✓; импорт-механизъм ✓ (Tasks 2–6); типове/капацитети валидирани в нормализацията ✓. Демо-бройките остават текущите (spec позволява); реалните идват през импорта.
- **Без placeholder-и:** всеки step има пълен код/команда. ✓
- **Type консистентност:** `ParsedRow` (types.ts) ползван еднакво в parse/apply; `ExtinguisherType` от `@/lib/regulatory/types`; `service_kind` стойности (`TO/recharge/powder_change/foam_change/HI`) съвпадат със схемата. ✓
- **Идемпотентност:** upsert по (обект, сериен №); събития само ако липсват. ✓

---

## Следващи фази (отделни планове, точно навреме)

Всяка стъпва на Фаза 1 и получава свой подробен план преди изпълнение:

- **Фаза 2 — AI стикер → протокол** (Компонент 2): Storage bucket `stickers`; `VisionProvider` интерфейс + „hermes" адаптер (`HERMES_VISION_URL`) + демо-fallback; `POST /api/vision/sticker`; разширяване на `/skan` + бутон на `/pg/[id]`; екран „Преглед" → Word; ръчен избор. *(Главната wow-функция.)*
- **Фаза 3 — Минимално въвеждане** (Компонент 3): форми „Нов обект/гасител" + „Запиши услуга"; `POST /api/service-events`; авто-преизчисляване на срокове през двигателя.
- **Фаза 4 — Демо напомняния** (Компонент 4): екран `/napomnyania`; `NotifyProvider` (hermes/Telegram + fallback преглед); `POST /api/reminders/send`.

*(PDF изход отпадна по желание на клиента — демото остава само Word.)*
