# Корекции на протокола — Implementation Plan

> Изпълнение: inline, TDD, чести коммити. Дизайнът е одобрен от клиента.

**Goal:** Протоколът (Приложение № 9) — всяка графа + заглавна част напълно редактируеми, с AI пред-попълване; коректни графи 2/3/4/6/11.

**Tech:** Next.js 16, Supabase, Vitest. Основен поток = StickerScan (`/skan`); вторичен = обект-протокол (`build.ts`).

---

### Task 1 — `deriveCategory(type)` (TDD)
**Files:** Create `src/lib/regulatory/category.ts`, Test `src/lib/regulatory/category.test.ts`
- Правило (БДС ISO 11602-2, под налягане — масовият случай): water/foam→`К1`, powder_abc/powder_bc→`К2`, co2→`К5`. (К3/К4 за газов патрон — ръчно от менюто.)
- [ ] Тест: water→К1, foam→К1, powder_abc→К2, powder_bc→К2, co2→К5.
- [ ] Имплементация → тестовете минават → commit.

### Task 2 — Схема: обща маса
**Files:** migration `add_gross_mass`
- [ ] `alter table extinguishers add column if not exists gross_mass_kg numeric;` (обща/бруто маса, различна от `mass_kg`=капацитет). Прилага се през Supabase (проект antoan09s).

### Task 3 — StickerScan: напълно редактируема форма (основен поток)
**Files:** Modify `src/components/StickerScan.tsx`
- [ ] Графа 3: ново падащо меню **Категория (К1–К5)**, авто-стойност = `deriveCategory(eType)`, редактируемо.
- [ ] Графа 4: ново поле **Обща маса (бруто), кг** (`eTotalMass`); протоколната `mass` = тази стойност (а не капацитета). AI пред-попълва от `raw`, ако се чете; иначе ръчно.
- [ ] Заглавна част редактируема дори без съвпадение: полета **Собственик (име/адрес/телефон)** — префил от match/избран обект, но editable.
- [ ] Графа 11 (стикер №) и техник — остават ръчни (вече ги има).
- [ ] `buildProtocol()` ползва eCategory, eTotalMass, editable owner.
- [ ] build + commit.

### Task 4 — build.ts (обект-протокол) консистентност
**Files:** Modify `src/lib/protocol/build.ts`
- [ ] Графа 3: `e.category ?? deriveCategory(e.type)`.
- [ ] Графа 4: `gross_mass_kg` (ако е null → празно).
- [ ] build + commit.

### Task 5 — въвеждане на обща маса/категория при добавяне/импорт
**Files:** `AddExtinguisherForm.tsx`, `api/extinguishers/route.ts`, `lib/import/parse.ts`, `lib/import/apply.ts`
- [ ] Форма + API: приемат `grossMassKg` (+ category по избор).
- [ ] Импорт: нови колони-синоними „обща маса"/„бруто" → gross_mass; „категория" → category.
- [ ] build + commit.

### Task 6 — изравняване на марките
**Files:** `StickerScan.tsx` (BRANDS), `parseRaw.ts` (KNOWN_BRANDS)
- [ ] Уверявам български: Спарк, Солти, Торнадо, Огнехром, Ятрус, Дрипалдер + вносни (Gloria, Bavaria, Total, Minimax…). Добавям липсващи.

### Task 7 — verify + deploy
- [ ] `npx vitest run` + `npm run build` зелено.
- [ ] push + деплой; жива E2E проверка в Chrome (сканиране → категория/обща маса/собственик редактируеми → генериране).

## Self-review
Покрива: графа 2 (вече), 3 (T1/T3/T4), 4 (T2/T3/T4/T5), 6 (вече), 11 (вече ръчно), всичко редактируемо (T3), марки (T6). Типова консистентност: `deriveCategory(type)→'К1'|'К2'|'К5'` еднаква в T1/T3/T4.
