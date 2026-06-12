# Самообслужване за обекти — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps use `- [ ]`.

**Goal:** Клиентът сам да създава нови обекти/клиенти през форма + лесен достъп до импорта.

**Architecture:** Общ helper `findOrCreateSite` (find-or-create клиент+обект, идемпотентно) ползван и от новия `POST /api/sites`, и от рефакторирания `applyImport` (DRY). Нова клиентска страница `/obekti/nov` + линкове в менюто.

**Tech Stack:** Next.js 16 App Router, Supabase service client, Vitest.

---

### Task 1: `findOrCreateSite` helper (TDD)

**Files:** Create `src/lib/import/site.ts`, Test `src/lib/import/site.test.ts`

- [ ] **Step 1: Failing test** (`site.test.ts`) — fake db (records insert-и, връща canned select):
```ts
import { describe, it, expect } from 'vitest';
import { findOrCreateSite } from './site';

function fakeDb(state: { clients: any[]; sites: any[] }) {
  return { from(table: 'clients' | 'sites') {
    const f: Record<string, unknown> = {};
    const q: any = {
      select: () => q,
      eq: (c: string, v: unknown) => { f[c] = v; return q; },
      maybeSingle: () => Promise.resolve({ data: state[table].find((r) => Object.entries(f).every(([k, v]) => r[k] === v)) ?? null }),
      insert: (obj: any) => { const id = `${table}-${state[table].length + 1}`; state[table].push({ id, ...obj }); return { select: () => ({ single: () => Promise.resolve({ data: { id } }) }) }; },
    };
    return q;
  } };
}

it('създава нов клиент + обект', async () => {
  const st = { clients: [] as any[], sites: [] as any[] };
  const r = await findOrCreateSite(fakeDb(st) as any, { clientName: 'ЕТ Нов', siteName: 'Склад А', address: 'Адрес 1', phone: '0888' });
  expect(r.createdClient).toBe(true); expect(r.createdSite).toBe(true); expect(r.siteId).toBeTruthy();
  expect(st.clients).toHaveLength(1); expect(st.sites).toHaveLength(1);
});
it('съществуващ клиент → нов обект, без дублиране на клиента', async () => {
  const st = { clients: [{ id: 'c1', name: 'ЕТ Стар' }], sites: [] as any[] };
  const r = await findOrCreateSite(fakeDb(st) as any, { clientName: 'ЕТ Стар', siteName: 'Склад Б' });
  expect(r.createdClient).toBe(false); expect(r.createdSite).toBe(true);
  expect(st.clients).toHaveLength(1); expect(st.sites).toHaveLength(1);
});
it('съществуващ клиент+обект → връща същия (идемпотентно)', async () => {
  const st = { clients: [{ id: 'c1', name: 'ЕТ Стар' }], sites: [{ id: 's1', client_id: 'c1', name: 'Склад Б' }] };
  const r = await findOrCreateSite(fakeDb(st) as any, { clientName: 'ЕТ Стар', siteName: 'Склад Б' });
  expect(r.siteId).toBe('s1'); expect(r.createdSite).toBe(false); expect(st.sites).toHaveLength(1);
});
it('празно име → грешка', async () => {
  await expect(findOrCreateSite(fakeDb({ clients: [], sites: [] }) as any, { clientName: '', siteName: 'X' })).rejects.toThrow();
});
```
- [ ] **Step 2: Run → fails** (`npx vitest run src/lib/import/site.test.ts`).
- [ ] **Step 3: Implement** (`site.ts`):
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
export interface FindOrCreateSiteInput { clientName: string; siteName: string; address?: string | null; phone?: string | null; }
export interface FindOrCreateSiteResult { siteId: string; createdClient: boolean; createdSite: boolean; }
export async function findOrCreateSite(db: SupabaseClient, input: FindOrCreateSiteInput): Promise<FindOrCreateSiteResult> {
  const clientName = (input.clientName ?? '').trim();
  const siteName = (input.siteName ?? '').trim();
  if (!clientName || !siteName) throw new Error('Липсва име на клиент или обект');
  const address = input.address?.trim() || null;
  const phone = input.phone?.trim() || null;
  let createdClient = false;
  const { data: c } = await db.from('clients').select('id').eq('name', clientName).maybeSingle();
  let clientId = (c as { id?: string } | null)?.id;
  if (!clientId) { const ins = await db.from('clients').insert({ name: clientName, address, phone }).select('id').single(); clientId = (ins.data as { id: string }).id; createdClient = true; }
  let createdSite = false;
  const { data: s } = await db.from('sites').select('id').eq('client_id', clientId).eq('name', siteName).maybeSingle();
  let siteId = (s as { id?: string } | null)?.id;
  if (!siteId) { const ins = await db.from('sites').insert({ client_id: clientId, name: siteName, address }).select('id').single(); siteId = (ins.data as { id: string }).id; createdSite = true; }
  return { siteId: siteId!, createdClient, createdSite };
}
```
- [ ] **Step 4: Run → passes.**
- [ ] **Step 5: Commit.**

### Task 2: Рефактор `applyImport` да ползва helper-а (DRY, пази кеша)
**Files:** Modify `src/lib/import/apply.ts`
- [ ] Замени блока за клиент+обект (намери-или-създай, ~редове 21-49) с кеширан `findOrCreateSite`:
```ts
import { findOrCreateSite } from './site';
// ...в цикъла, вместо ръчния client/site код:
const siteKey = `${r.client}|${r.site}`;
let siteId = siteIds.get(siteKey);
if (!siteId) {
  const res = await findOrCreateSite(db, { clientName: r.client, siteName: r.site });
  siteId = res.siteId;
  if (res.createdClient) summary.clients++;
  if (res.createdSite) summary.sites++;
  siteIds.set(siteKey, siteId);
}
```
(Махни вече ненужния `clientIds` Map.) Останалото (brand/extinguisher/events) — без промяна.
- [ ] Run всички тестове → зелено; `npm run build`. Commit.

### Task 3: `POST /api/sites`
**Files:** Modify `src/app/api/sites/route.ts` (добавя POST; GET остава)
- [ ] Добави:
```ts
import { findOrCreateSite } from '@/lib/import/site';
export async function POST(req: Request) {
  let b: { clientName?: string; siteName?: string; address?: string; phone?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Невалиден JSON' }, { status: 400 }); }
  if (!b.clientName?.trim() || !b.siteName?.trim()) return NextResponse.json({ ok: false, error: 'Липсва име на клиент или обект' }, { status: 400 });
  try {
    const r = await findOrCreateSite(createServiceClient(), { clientName: b.clientName, siteName: b.siteName, address: b.address, phone: b.phone });
    return NextResponse.json({ ok: true, siteId: r.siteId, createdSite: r.createdSite });
  } catch (e) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 }); }
}
```
- [ ] Build. Commit.

### Task 4: Страница `/obekti/nov`
**Files:** Create `src/app/obekti/nov/page.tsx` (client component)
- [ ] Форма (Име на обект, Клиент, Адрес, Телефон) → `POST /api/sites` → при ok `window.location.href = '/obekt/'+siteId`. Грешки се показват. Стил: `.wrap`, `.btn btn-fire`, глобален form (16px). Линк „← Табло".
- [ ] Build. Commit.

### Task 5: Линкове в менюто
**Files:** Modify `src/app/page.tsx` (топбар)
- [ ] Добави преди „📷 Сканирай": `<Link href="/obekti/nov" className="nav-link">🏢 Нов обект</Link>` и `<Link href="/admin/import" className="nav-link">📥 Импорт</Link>`.
- [ ] Build. Commit.

### Task 6: Verify + deploy
- [ ] `npx vitest run` (всичко зелено) + `npm run build`.
- [ ] Push (с retry), изчакай деплой.
- [ ] Жива E2E през Chrome: `/obekti/nov` → създай тестов обект → отваря картата му; провери линковете в менюто.

## Self-Review
- Spec coverage: helper(T1)✓, refactor(T2)✓, API(T3)✓, страница(T4)✓, навигация(T5)✓, тестове(T1)+verify(T6)✓.
- Без placeholder-и: код за всяка стъпка ✓.
- Типова консистентност: `findOrCreateSite(db, input)` еднакъв подпис в T1/T2/T3 ✓.
