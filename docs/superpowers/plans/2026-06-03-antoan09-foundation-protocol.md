# Антоан-09 · План 1 — Гръбнак (двигател + протокол 1-към-1)

> **За агентни работници:** ЗАДЪЛЖИТЕЛЕН SUB-SKILL: ползвай `superpowers:subagent-driven-development` (препоръчано) или `superpowers:executing-plans` за изпълнение task-по-task. Стъпките са с checkbox (`- [ ]`).

**Goal:** Работещ Next.js проект, който чете реални данни от Supabase, изчислява нормативния статус (ТО/ПЗ/ХИ/БРАК) и генерира официалния протокол (Приложение № 9) като **Word, идентичен на образеца**.

**Architecture:** Next.js (App Router, TS) на Vercel. Чист модул „нормативен двигател" (без I/O, 100% unit-тестван). Supabase Postgres за данните. Генериране на Word чрез `docxtemplater`, който попълва техния `.docx` шаблон с placeholder-и → байт-точно копие.

**Tech Stack:** Next.js 15 (App Router, TypeScript, Tailwind), Supabase (`@supabase/supabase-js`, `@supabase/ssr`), `docxtemplater` + `pizzip`, Vitest.

**Референтна спецификация:** [docs/superpowers/specs/2026-06-03-antoan09-pozharogasiteli-demo-design.md](../specs/2026-06-03-antoan09-pozharogasiteli-demo-design.md)

---

## Структура на файловете (План 1)

```
antoan-09/
├─ .gitignore, .env.local.example, next.config.mjs, vitest.config.ts
├─ templates/predavatelen-protokol.docx          # техния .docx с placeholder-и (каноничен)
├─ supabase/migrations/0001_init.sql             # схема
├─ supabase/seed.sql                             # каталог + демо обект (вкл. реалния пример)
├─ src/
│  ├─ lib/regulatory/types.ts                    # типове на двигателя
│  ├─ lib/regulatory/engine.ts                   # чисти функции (ядро)
│  ├─ lib/regulatory/engine.test.ts
│  ├─ lib/protocol/types.ts                       # ProtocolData/ProtocolLineData
│  ├─ lib/protocol/protocolNumber.ts             # пореден/година
│  ├─ lib/protocol/protocolNumber.test.ts
│  ├─ lib/protocol/generateDocx.ts               # docxtemplater fill
│  ├─ lib/protocol/generateDocx.test.ts
│  ├─ lib/supabase/server.ts                     # сървърен Supabase клиент
│  ├─ app/api/protocols/generate/route.ts        # API: site → docx
│  └─ app/page.tsx                               # минимален UI (избор на обект → сваляне)
```

**Граници:** всеки файл — една отговорност. Двигателят няма зависимости към Supabase/Next. Генерирането на docx не знае за HTTP. Това ги прави независимо тестваеми.

---

## Task 0: Scaffold на проекта + инструменти

**Files:**
- Create: `package.json`, `next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `.gitignore`, `.env.local.example`, `vitest.config.ts`

- [ ] **Step 1: Scaffold Next.js в текущата папка**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*" --no-turbopack --use-npm
```
Очаквано: създава Next.js проект. (`docs/` и `.git/` не са в конфликт — create-next-app ги подминава.) При въпрос за презаписване на нищо — продължи.

- [ ] **Step 2: Инсталирай зависимости**

Run:
```bash
npm i docxtemplater pizzip @supabase/supabase-js @supabase/ssr
npm i -D vitest
```
Очаквано: добавени в `package.json`, без грешки.

- [ ] **Step 3: Конфигурирай Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

- [ ] **Step 4: Добави npm скриптове**

Modify `package.json` — в секцията `"scripts"` добави:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Създай `.env.local.example`**

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 6: Допълни `.gitignore`**

Увери се, че `.gitignore` съдържа (create-next-app добавя повечето; добави липсващите):
```
.env.local
.env*.local
/node_modules
/.next
*.tmp
```

- [ ] **Step 7: Провери, че билдът/тестът тръгват**

Run:
```bash
npm run test
```
Очаквано: Vitest стартира, „No test files found" (още няма тестове) — това е ок.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Supabase + docxtemplater + vitest"
```

---

## Task 1: Supabase схема (миграция)

**Files:**
- Create: `supabase/migrations/0001_init.sql`

- [ ] **Step 1: Напиши схемата**

Create `supabase/migrations/0001_init.sql`:
```sql
-- Каталог
create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

-- Клиенти (собственици) и обекти
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  eik text
);

create table sites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  address text
);

-- Пожарогасители
create type extinguisher_type as enum ('powder_abc','powder_bc','water','foam','co2');

create table extinguishers (
  id uuid primary key default gen_random_uuid(),     -- = QR payload
  site_id uuid not null references sites(id) on delete cascade,
  brand_id uuid references brands(id),
  model text,
  type extinguisher_type not null,
  serial_number text,
  manufacture_year int not null,
  category text,                                     -- БДС ISO 11602-2, напр. "К2"
  mass_kg numeric(6,3),                              -- маса на заредения
  stamp_year int,                                    -- макс. година за експлоатация
  created_at timestamptz not null default now()
);

-- История на обслужванията
create type service_kind as enum ('TO','recharge','powder_change','foam_change','HI');

create table service_events (
  id uuid primary key default gen_random_uuid(),
  extinguisher_id uuid not null references extinguishers(id) on delete cascade,
  kind service_kind not null,
  service_date date not null,
  technician_name text,
  agent_trade_name text,                             -- търговско наименование на в-вото (при ПЗ/ХИ)
  notes text,
  created_at timestamptz not null default now()
);

-- Протоколи
create table protocols (
  id uuid primary key default gen_random_uuid(),
  number text not null,                              -- "55/2026"
  protocol_date date not null,
  city text not null default 'Нова Загора',
  site_id uuid not null references sites(id),
  representative text not null default 'В. Вълков',
  created_at timestamptz not null default now()
);

create table protocol_lines (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references protocols(id) on delete cascade,
  extinguisher_id uuid references extinguishers(id),
  idx int not null,                                  -- № по ред
  markings text not null,                            -- кол.2
  category text,                                     -- кол.3
  mass_kg text,                                      -- кол.4 (текст, за форматиране "1,600")
  agent text,                                        -- кол.5
  agent_trade_name text,                             -- кол.6
  service_kind text not null,                        -- кол.7 ("ТО"/"П"/"ХИ")
  service_date text not null,                        -- кол.8 "27.05.2026"
  technician_name text,                              -- кол.9
  sticker_no text                                    -- кол.11
);
```

- [ ] **Step 2: Приложи миграцията**

Приложи `0001_init.sql` към Supabase проекта (през Supabase MCP `apply_migration`, Supabase CLI, или SQL editor).
Очаквано: таблиците са създадени без грешки.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat(db): initial schema for extinguishers, service events, protocols"
```

---

## Task 2: Seed данни (каталог + реален пример)

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Напиши seed-а**

Create `supabase/seed.sql`:
```sql
insert into brands (name) values
 ('Солти'),('Огнехром'),('Дрипалдер'),('Ятрус'),('Торнадо'),
 ('Sparky'),('Gloria'),('Bavaria'),('Total'),('Ceasefire'),
 ('Minimax'),('Tyco'),('Sicli'),('Chubb'),('FirePro'),('Ansul'),('Kidde')
on conflict (name) do nothing;

-- Демо клиент + обект
insert into clients (id, name, address, phone, eik) values
 ('11111111-1111-1111-1111-111111111111','ЕТ Демо Клиент','гр. Нова Загора, ул. Демо 1','0888000111','111111111');

insert into sites (id, client_id, name, address) values
 ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','Склад №1','гр. Нова Загора, ул. Демо 1');

-- Реален пример от бланката: Прахов 1 кг № 5487/2019, К2, 1.600 кг, ТО, стикер 0615
insert into extinguishers (id, site_id, type, model, serial_number, manufacture_year, category, mass_kg, stamp_year) values
 ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','powder_abc','Прахов 1 кг','5487',2019,'К2',1.600,2034),
 ('33333333-3333-3333-3333-333333333334','22222222-2222-2222-2222-222222222222','co2','CO2 5 кг','7781',2015,'К1',5.000,2025);

insert into service_events (extinguisher_id, kind, service_date, technician_name) values
 ('33333333-3333-3333-3333-333333333333','TO','2025-05-27','Х. Христов');
```

- [ ] **Step 2: Приложи seed-а**

Изпълни `supabase/seed.sql` срещу проекта.
Очаквано: 17 марки, 1 клиент, 1 обект, 2 пожарогасителя, 1 история. Вторият (CO2, щампа 2025) ще е БРАК при текуща година 2026.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat(db): seed catalog and demo site with real example data"
```

---

## Task 3: Нормативен двигател (TDD)

**Files:**
- Create: `src/lib/regulatory/types.ts`, `src/lib/regulatory/engine.ts`
- Test: `src/lib/regulatory/engine.test.ts`

- [ ] **Step 1: Дефинирай типовете**

Create `src/lib/regulatory/types.ts`:
```ts
export type ExtinguisherType = 'powder_abc' | 'powder_bc' | 'water' | 'foam' | 'co2';
export type SuggestedAction = 'TO' | 'recharge' | 'HI' | 'scrap';

export interface EngineInput {
  type: ExtinguisherType;
  manufactureYear: number;
  stampYear: number | null;        // макс. година за експлоатация (от щампата)
  lastTO: string | null;           // ISO "YYYY-MM-DD"
  lastRecharge: string | null;     // ISO (П / смяна прах|пяна)
  lastHI: string | null;           // ISO
  today: string;                   // ISO
}

export interface EngineResult {
  suggestedAction: SuggestedAction;
  isScrapped: boolean;
  reasons: string[];
  dueDates: {
    to: string;                    // следващо ТО
    rechargeOrChange: string | null; // следваща 2-год. смяна (null за water/co2)
    hi: string;                    // следващо ХИ
  };
}
```

- [ ] **Step 2: Напиши провалящите се тестове**

Create `src/lib/regulatory/engine.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeExtinguisherStatus } from './engine';

const base = {
  type: 'powder_abc' as const,
  manufactureYear: 2020,
  stampYear: 2035,
  lastTO: null,
  lastRecharge: null,
  lastHI: null,
  today: '2026-06-03',
};

describe('computeExtinguisherStatus', () => {
  it('маркира БРАК, ако текущата година > година на щампата', () => {
    const r = computeExtinguisherStatus({ ...base, stampYear: 2025 });
    expect(r.isScrapped).toBe(true);
    expect(r.suggestedAction).toBe('scrap');
  });

  it('не е БРАК, когато stampYear е null', () => {
    const r = computeExtinguisherStatus({ ...base, stampYear: null });
    expect(r.isScrapped).toBe(false);
  });

  it('предлага ХИ, когато са минали 10 г. от производството без ХИ', () => {
    const r = computeExtinguisherStatus({ ...base, manufactureYear: 2010 });
    expect(r.suggestedAction).toBe('HI');
  });

  it('предлага презареждане за прахов на 2 г. (без ХИ дължимо)', () => {
    const r = computeExtinguisherStatus({
      ...base, manufactureYear: 2024, lastHI: '2024-01-01', lastRecharge: '2024-01-01',
    });
    expect(r.suggestedAction).toBe('recharge');
  });

  it('предлага ТО, когато само годишното ТО е дължимо', () => {
    const r = computeExtinguisherStatus({
      ...base, manufactureYear: 2025, lastHI: '2025-01-01', lastRecharge: '2025-01-01', lastTO: '2025-01-01',
    });
    expect(r.suggestedAction).toBe('TO');
  });

  it('CO2 няма 2-годишна смяна (rechargeOrChange = null)', () => {
    const r = computeExtinguisherStatus({
      ...base, type: 'co2', manufactureYear: 2024, lastHI: '2024-01-01',
    });
    expect(r.dueDates.rechargeOrChange).toBeNull();
    expect(r.suggestedAction).toBe('TO');
  });
});
```

- [ ] **Step 3: Пусни тестовете — трябва да се провалят**

Run: `npm run test -- src/lib/regulatory/engine.test.ts`
Очаквано: FAIL (`computeExtinguisherStatus` не съществува).

- [ ] **Step 4: Имплементирай двигателя**

Create `src/lib/regulatory/engine.ts`:
```ts
import type { EngineInput, EngineResult, SuggestedAction, ExtinguisherType } from './types';

function addYears(iso: string, years: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function has2yChange(type: ExtinguisherType): boolean {
  return type === 'powder_abc' || type === 'powder_bc' || type === 'foam';
}

export function computeExtinguisherStatus(input: EngineInput): EngineResult {
  const today = new Date(input.today + 'T00:00:00Z');
  const reasons: string[] = [];

  const anchor = `${input.manufactureYear}-01-01`;
  const lastTO = input.lastTO ?? anchor;
  const lastRecharge = input.lastRecharge ?? anchor;
  const lastHI = input.lastHI ?? anchor;

  const dueDates = {
    to: addYears(lastTO, 1),
    rechargeOrChange: has2yChange(input.type) ? addYears(lastRecharge, 2) : null,
    hi: addYears(lastHI, 10),
  };

  if (input.stampYear !== null && today.getUTCFullYear() > input.stampYear) {
    reasons.push(`Годината на щампата (${input.stampYear}) е изтекла — БРАК.`);
    return { suggestedAction: 'scrap', isScrapped: true, reasons, dueDates };
  }

  const due = (iso: string | null) => iso !== null && new Date(iso + 'T00:00:00Z') <= today;

  let suggestedAction: SuggestedAction = 'TO';
  if (due(dueDates.hi)) {
    suggestedAction = 'HI';
    reasons.push('Дължимо хидростатично изпитание (10 г.).');
  } else if (due(dueDates.rechargeOrChange)) {
    suggestedAction = 'recharge';
    reasons.push('Дължимо презареждане/смяна (2 г.).');
  } else if (due(dueDates.to)) {
    suggestedAction = 'TO';
    reasons.push('Дължимо годишно техническо обслужване.');
  } else {
    reasons.push('Няма просрочени дейности; предложено е ТО.');
  }

  return { suggestedAction, isScrapped: false, reasons, dueDates };
}
```

- [ ] **Step 5: Пусни тестовете — трябва да минат**

Run: `npm run test -- src/lib/regulatory/engine.test.ts`
Очаквано: PASS (6 теста).

- [ ] **Step 6: Commit**

```bash
git add src/lib/regulatory
git commit -m "feat(regulatory): pure status engine (TO/recharge/HI/scrap) with tests"
```

---

## Task 4: Номер на протокол (TDD)

**Files:**
- Create: `src/lib/protocol/protocolNumber.ts`
- Test: `src/lib/protocol/protocolNumber.test.ts`

- [ ] **Step 1: Напиши теста**

Create `src/lib/protocol/protocolNumber.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { nextProtocolNumber } from './protocolNumber';

describe('nextProtocolNumber', () => {
  it('форматира като пореден/година', () => {
    expect(nextProtocolNumber(2026, 54)).toBe('55/2026');
  });
  it('започва от 1 за нова година', () => {
    expect(nextProtocolNumber(2027, 0)).toBe('1/2027');
  });
});
```

- [ ] **Step 2: Пусни — fail**

Run: `npm run test -- src/lib/protocol/protocolNumber.test.ts`
Очаквано: FAIL (липсва функцията).

- [ ] **Step 3: Имплементирай**

Create `src/lib/protocol/protocolNumber.ts`:
```ts
/** Връща следващия номер на протокол като "пореден/година". */
export function nextProtocolNumber(year: number, countThisYear: number): string {
  return `${countThisYear + 1}/${year}`;
}
```

- [ ] **Step 4: Пусни — pass**

Run: `npm run test -- src/lib/protocol/protocolNumber.test.ts`
Очаквано: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/protocol/protocolNumber.ts src/lib/protocol/protocolNumber.test.ts
git commit -m "feat(protocol): sequential protocol number helper with tests"
```

---

## Task 5: Подготовка на Word шаблона (placeholder-и)

**Files:**
- Create: `templates/predavatelen-protokol.docx` (от техния образец)

Ползвай `anthropic-skills:docx` (unpack → edit XML → pack).

- [ ] **Step 1: Копирай образеца в репото**

Run:
```bash
mkdir templates
copy "C:\Users\User\Desktop\CRM Софтуери\АНТОАН-09 ЕООД\ПРЕДАВАТЕЛЕН ПРОТОКОЛ.docx" "templates\predavatelen-protokol.docx"
```
Очаквано: файлът е в `templates/`.

- [ ] **Step 2: Unpack**

Run (път до скрипта от docx skill):
```bash
python "<docx-skill>/scripts/office/unpack.py" templates/predavatelen-protokol.docx templates/_unpacked/
```
Очаквано: `templates/_unpacked/word/document.xml` съществува.

- [ ] **Step 3: Вмъкни placeholder-ите (Edit на `templates/_unpacked/word/document.xml`)**

Замени конкретните стойности с docxtemplater placeholder-и (delimiters `{ }`):
- Заглавието „ПРОТОКОЛ № " → след „№ " добави `{protocolNo}`.
- В уводния абзац: датата „03.06.2026" → `{date}`; „гр. Нова Загора" → `гр. {city}`.
- **Редовете на таблицата:** остави САМО първия данни-ред (R3). Изтрий празните редове R4–R12. В оставения ред:
  - кол.1 → `{idx}` · кол.2 → `{markings}` · кол.3 → `{category}` · кол.4 → `{mass}` · кол.5 → `{agent}` · кол.6 → `{agentTradeName}` · кол.7 → `{serviceKind}` · кол.8 → `{serviceDate}` · кол.9 → `{technicianName}` · кол.10 → (празно) · кол.11 → `{stickerNo}`.
  - Загради реда за повтаряне: в началото на текста на кол.1 сложи `{#lines}` преди `{idx}`, а в края на текста на кол.11 сложи `{/lines}` след `{stickerNo}`.
- Блок „Собственик": след „Собственик на пожарогасителя/ите:" → `{ownerName}`; „адрес:" → `адрес: {ownerAddress}`; „тел." → `тел. {ownerPhone}`.

> Правило: всеки placeholder трябва да е в рамките на един `<w:t>` (без разделяне между runs), за да го хване docxtemplater. unpack.py обединява съседни runs — ако placeholder е разделен, обедини текста ръчно в един `<w:t>`.

- [ ] **Step 4: Pack**

Run:
```bash
python "<docx-skill>/scripts/office/pack.py" templates/_unpacked/ templates/predavatelen-protokol.docx --original templates/predavatelen-protokol.docx
```
Очаквано: валиден `.docx` с placeholder-и.

- [ ] **Step 5: Изчисти и commit**

```bash
rmdir /s /q templates\_unpacked
git add templates/predavatelen-protokol.docx
git commit -m "feat(protocol): add docx template with docxtemplater placeholders"
```

---

## Task 6: Генериране на Word (TDD)

**Files:**
- Create: `src/lib/protocol/types.ts`, `src/lib/protocol/generateDocx.ts`
- Test: `src/lib/protocol/generateDocx.test.ts`

- [ ] **Step 1: Дефинирай типовете на протокола**

Create `src/lib/protocol/types.ts`:
```ts
export interface ProtocolLineData {
  idx: number;
  markings: string;          // "Прахов 1 кг № 5487 / 2019"
  category: string;          // "К2"
  mass: string;              // "1,600"
  agent: string;             // "Прах"
  agentTradeName: string;    // "" при ТО
  serviceKind: string;       // "ТО" | "П" | "ХИ"
  serviceDate: string;       // "27.05.2026"
  technicianName: string;    // "Х. Христов"
  stickerNo: string;         // "0615"
}

export interface ProtocolData {
  protocolNo: string;        // "55/2026"
  date: string;              // "03.06.2026"
  city: string;              // "Нова Загора"
  ownerName: string;
  ownerAddress: string;
  ownerPhone: string;
  lines: ProtocolLineData[];
}
```

- [ ] **Step 2: Напиши теста**

Create `src/lib/protocol/generateDocx.test.ts`:
```ts
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
```

- [ ] **Step 3: Пусни — fail**

Run: `npm run test -- src/lib/protocol/generateDocx.test.ts`
Очаквано: FAIL (липсва модулът).

- [ ] **Step 4: Имплементирай генерирането**

Create `src/lib/protocol/generateDocx.ts`:
```ts
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
  doc.render(data);
  return doc.getZip().generate({ type: 'nodebuffer' });
}
```

- [ ] **Step 5: Пусни — pass**

Run: `npm run test -- src/lib/protocol/generateDocx.test.ts`
Очаквано: PASS. (Ако падне заради разделен placeholder — върни се на Task 5, Step 3, обедини текста в един `<w:t>`.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/protocol/types.ts src/lib/protocol/generateDocx.ts src/lib/protocol/generateDocx.test.ts
git commit -m "feat(protocol): fill docx template from data with tests"
```

---

## Task 7: API + минимален UI (обект → сваляне на протокол)

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/app/api/protocols/generate/route.ts`, `src/app/page.tsx`

- [ ] **Step 1: Сървърен Supabase клиент**

Create `src/lib/supabase/server.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
```

- [ ] **Step 2: API route — сглобява данните и връща .docx**

Create `src/app/api/protocols/generate/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { computeExtinguisherStatus } from '@/lib/regulatory/engine';
import type { ExtinguisherType } from '@/lib/regulatory/types';
import { nextProtocolNumber } from '@/lib/protocol/protocolNumber';
import { generateProtocolDocx } from '@/lib/protocol/generateDocx';
import type { ProtocolData, ProtocolLineData } from '@/lib/protocol/types';

const AGENT_LABEL: Record<ExtinguisherType, string> = {
  powder_abc: 'Прах', powder_bc: 'Прах', water: 'Вода', foam: 'Пяна', co2: 'CO2',
};
const ACTION_LABEL: Record<string, string> = { TO: 'ТО', recharge: 'П', HI: 'ХИ', scrap: 'БРАК' };

function bgDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export async function POST(req: NextRequest) {
  const { siteId } = await req.json();
  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: site } = await supabase
    .from('sites').select('id,name,address,clients(name,address,phone)').eq('id', siteId).single();
  if (!site) return NextResponse.json({ error: 'site not found' }, { status: 404 });

  const { data: exts } = await supabase
    .from('extinguishers').select('*').eq('site_id', siteId).order('created_at');

  const { count } = await supabase
    .from('protocols').select('*', { count: 'exact', head: true })
    .gte('protocol_date', `${today.slice(0, 4)}-01-01`);

  const lines: ProtocolLineData[] = (exts ?? []).map((e, i) => {
    const status = computeExtinguisherStatus({
      type: e.type, manufactureYear: e.manufacture_year, stampYear: e.stamp_year,
      lastTO: null, lastRecharge: null, lastHI: null, today,
    });
    return {
      idx: i + 1,
      markings: `${e.model ?? ''} № ${e.serial_number ?? ''} / ${e.manufacture_year}`.trim(),
      category: e.category ?? '',
      mass: e.mass_kg != null ? String(e.mass_kg).replace('.', ',') : '',
      agent: AGENT_LABEL[e.type as ExtinguisherType],
      agentTradeName: '',
      serviceKind: ACTION_LABEL[status.suggestedAction],
      serviceDate: bgDate(today),
      technicianName: 'Х. Христов',
      stickerNo: '',
    };
  });

  const client = (site as { clients?: { name: string; address: string; phone: string } }).clients;
  const data: ProtocolData = {
    protocolNo: nextProtocolNumber(Number(today.slice(0, 4)), count ?? 0),
    date: bgDate(today),
    city: 'Нова Загора',
    ownerName: client?.name ?? '',
    ownerAddress: client?.address ?? '',
    ownerPhone: client?.phone ?? '',
    lines,
  };

  const buf = generateProtocolDocx(data);
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="protokol-${data.protocolNo.replace('/', '-')}.docx"`,
    },
  });
}
```

- [ ] **Step 3: Минимална страница с бутон**

Replace `src/app/page.tsx`:
```tsx
'use client';
import { useState } from 'react';

const DEMO_SITE_ID = '22222222-2222-2222-2222-222222222222';

export default function Home() {
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch('/api/protocols/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: DEMO_SITE_ID }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'protokol.docx';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>Антоан-09 · Протокол (демо)</h1>
      <p>Генерира протокол 1-към-1 за демо обект „Склад №1".</p>
      <button onClick={generate} disabled={busy} style={{ padding: '12px 24px', fontSize: 16 }}>
        {busy ? 'Генерирам…' : 'Генерирай протокол (Word)'}
      </button>
    </main>
  );
}
```

- [ ] **Step 4: Ръчна проверка**

Run: `npm run dev`, отвори `http://localhost:3000`, попълни `.env.local` (от `.env.local.example`), натисни бутона.
Очаквано: сваля се `.docx`, който се отваря в Word **идентичен на образеца**, с попълнен ред за пожарогасител № 5487/2019 и втори ред (CO2 7781) маркиран „БРАК".

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/server.ts src/app/api/protocols/generate/route.ts src/app/page.tsx
git commit -m "feat: generate-protocol API and minimal UI"
```

---

## Self-Review (изпълнено)

**1. Покритие спрямо спецификацията (План 1 обхват):**
- Стек (Next.js/Supabase/docxtemplater/Vitest) → Task 0. ✓
- Модел на данните (clients/sites/extinguishers/service_events/protocols/protocol_lines) → Task 1. ✓
- Сийднат каталог + реален пример → Task 2. ✓
- Нормативен двигател (ТО/ПЗ/ХИ/БРАК, БРАК по щампа) → Task 3. ✓
- Номер на протокол (пореден/година) → Task 4. ✓
- Word 1-към-1 от техния шаблон → Tasks 5–6. ✓
- Сглобяване на протокол от реални данни → Task 7. ✓
- *Извън План 1 (по дизайн):* QR/CV/меню входове (План 2), Hermes/Telegram (План 3), PDF/PWA/дашборд (План 4).

**2. Placeholder scan:** няма „TBD/TODO"; всеки code-step има пълен код или точна команда. `<docx-skill>` в Task 5 е реален път до инсталирания docx skill (резолвва се при изпълнение).

**3. Консистентност на типовете:** `ExtinguisherType`, `SuggestedAction`, `EngineInput/EngineResult` (regulatory/types.ts) се ползват еднакво в engine.ts и в API route-а; `ProtocolData/ProtocolLineData` (protocol/types.ts) се ползват в generateDocx.ts, теста и route-а. `nextProtocolNumber(year, count)` — еднаква сигнатура навсякъде. ✓

---

## Execution Handoff

След одобрение — два начина за изпълнение:
1. **Subagent-Driven (препоръчано)** — свеж subagent на task, ревю между task-овете.
2. **Inline** — изпълнение в текущата сесия с checkpoint-и.
