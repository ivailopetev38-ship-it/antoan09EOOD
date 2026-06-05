# Антоан-09 Демо-кръг 2 · Фаза 4: Демо напомняния — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Екран „Напомняния" с предстоящи/просрочени падежи + бутон „Изпрати напомняне" (през Hermes/Telegram, с fallback преглед на текста).

**Architecture:** Чисто съставяне на текста (`composeReminder`, тестваемо) + `NotifyProvider` (адаптер „hermes" към `HERMES_NOTIFY_URL`; fallback връща текста за преглед). Страницата преизползва `getEnrichedExtinguishers` (има статус + обект + клиент).

**Спец:** Компонент 4. **Референции:** `getEnrichedExtinguishers()` (`src/lib/dashboard/queries.ts`) → `EnrichedExt` (status{level,label,nextDue,daysUntil,dueAction}, siteName, clientName). Route pattern: `src/app/api/import/route.ts`. Без OpenAI ключ.

---

## File Structure
- Create: `src/lib/notify/message.ts` + `message.test.ts` — `composeReminder` (pure).
- Create: `src/lib/notify/provider.ts` — `NotifyProvider` (hermes + fallback).
- Create: `src/app/api/reminders/send/route.ts` — POST → compose + notify.
- Create: `src/components/ReminderButton.tsx` — client бутон.
- Create: `src/app/napomnyania/page.tsx` — списък + бутони.
- Modify: `src/app/page.tsx` — линк към „Напомняния".

---

## Task 1: composeReminder (pure, TDD)

**Files:** Create `src/lib/notify/message.ts`, `message.test.ts`

- [ ] **Step 1: Тест**
```ts
import { describe, it, expect } from 'vitest';
import { composeReminder } from './message';

describe('composeReminder', () => {
  it('предстоящо ХИ', () => {
    const t = composeReminder({ clientName: 'ЕТ Орлов', siteName: 'Складове Дунав', model: 'Спарк 6 кг', serial: '0036', action: 'HI', nextDue: '2026-07-01', overdue: false });
    expect(t).toMatch(/Предстои/);
    expect(t).toMatch(/хидростатично/i);
    expect(t).toMatch(/01\.07\.2026/);
    expect(t).toMatch(/0036/);
  });
  it('просрочено ТО', () => {
    const t = composeReminder({ clientName: 'ЕТ Орлов', siteName: 'Дунав', model: null, serial: 'P-441', action: 'TO', nextDue: '2026-01-10', overdue: true });
    expect(t).toMatch(/Просрочено/);
    expect(t).toMatch(/техническо/i);
  });
});
```

- [ ] **Step 2: Run → fail.** `npx vitest run src/lib/notify/message.test.ts`

- [ ] **Step 3: Имплементация**
```ts
export interface ReminderItem {
  clientName: string;
  siteName: string;
  model: string | null;
  serial: string | null;
  action: 'TO' | 'recharge' | 'HI' | null;
  nextDue: string;
  overdue: boolean;
}

const ACTION: Record<'TO' | 'recharge' | 'HI', string> = {
  TO: 'техническо обслужване',
  recharge: 'презареждане',
  HI: 'хидростатично изпитване',
};

function bg(iso: string): string {
  return iso.split('-').reverse().join('.');
}

export function composeReminder(it: ReminderItem): string {
  const what = it.action ? ACTION[it.action] : 'обслужване';
  const dev = `${it.model ?? 'пожарогасител'}${it.serial ? ` № ${it.serial}` : ''}`;
  const head = it.overdue
    ? `Просрочено ${what} (от ${bg(it.nextDue)})`
    : `Предстои ${what} на ${bg(it.nextDue)}`;
  return `Уважаеми клиенти (${it.clientName}),\n${head} за ${dev} на обект „${it.siteName}".\nМоля, свържете се с нас за насрочване на сервиз. — АНТОАН-09`;
}
```

- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** → `git add src/lib/notify/message.ts src/lib/notify/message.test.ts && git commit -m "feat(notify): composeReminder text + tests"`

---

## Task 2: NotifyProvider + route

**Files:** Create `src/lib/notify/provider.ts`, `src/app/api/reminders/send/route.ts`

- [ ] **Step 1: Провайдър**
```ts
export interface NotifyResult { sent: boolean; preview: string; channel: string; }
export interface NotifyProvider { send(text: string): Promise<NotifyResult>; }

function hermesNotify(url: string, token: string): NotifyProvider {
  return {
    async send(text: string): Promise<NotifyResult> {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`Hermes notify ${res.status}`);
      return { sent: true, preview: text, channel: 'telegram' };
    },
  };
}

function fallbackNotify(): NotifyProvider {
  return { async send(text: string): Promise<NotifyResult> { return { sent: false, preview: text, channel: 'preview' }; } };
}

export function getNotifyProvider(): NotifyProvider {
  const url = process.env.HERMES_NOTIFY_URL;
  const token = process.env.HERMES_API_TOKEN ?? '';
  return url ? hermesNotify(url, token) : fallbackNotify();
}
```

- [ ] **Step 2: Route** `src/app/api/reminders/send/route.ts`
```ts
import { NextResponse } from 'next/server';
import { composeReminder, type ReminderItem } from '@/lib/notify/message';
import { getNotifyProvider } from '@/lib/notify/provider';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let b: Partial<ReminderItem>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Невалиден JSON' }, { status: 400 }); }
  if (!b.clientName || !b.siteName || !b.nextDue) {
    return NextResponse.json({ ok: false, error: 'Липсват полета' }, { status: 400 });
  }
  const text = composeReminder({
    clientName: b.clientName, siteName: b.siteName, model: b.model ?? null, serial: b.serial ?? null,
    action: b.action ?? null, nextDue: b.nextDue, overdue: b.overdue ?? false,
  });
  try {
    const r = await getNotifyProvider().send(text);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
```

- [ ] **Step 3: tsc** → 0.
- [ ] **Step 4: Commit** → `git add src/lib/notify/provider.ts src/app/api/reminders/send/route.ts && git commit -m "feat(notify): NotifyProvider (hermes/Telegram + fallback) + POST /api/reminders/send"`

---

## Task 3: ReminderButton + страница + линк

**Files:** Create `src/components/ReminderButton.tsx`, `src/app/napomnyania/page.tsx`; Modify `src/app/page.tsx`

- [ ] **Step 1: Бутон**
```tsx
'use client';
import { useState } from 'react';

interface Props {
  clientName: string; siteName: string; model: string | null; serial: string | null;
  action: 'TO' | 'recharge' | 'HI' | null; nextDue: string; overdue: boolean;
}

export default function ReminderButton(p: Props) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ sent: boolean; preview: string } | null>(null);

  async function send() {
    setBusy(true);
    try {
      const r = await fetch('/api/reminders/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p),
      });
      const j = await r.json();
      if (j.ok) setRes({ sent: j.sent, preview: j.preview });
    } finally { setBusy(false); }
  }

  return (
    <div>
      <button className="btn" style={{ border: '1px solid var(--line2)', color: 'inherit' }} disabled={busy} onClick={send}>
        {busy ? '…' : '🔔 Изпрати напомняне'}
      </button>
      {res && (
        <div style={{ marginTop: 8, padding: 10, border: '1px solid var(--line2)', borderRadius: 10 }}>
          <p className="hint" style={{ color: res.sent ? 'var(--ok)' : 'var(--soon)' }}>
            {res.sent ? '✓ Изпратено през Telegram' : '👁 Преглед (Hermes не е вързан — текстът, който ще се изпрати):'}
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, margin: '6px 0 0' }}>{res.preview}</pre>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Страница** `src/app/napomnyania/page.tsx`
```tsx
import Link from 'next/link';
import { getEnrichedExtinguishers } from '@/lib/dashboard/queries';
import ReminderButton from '@/components/ReminderButton';

export const dynamic = 'force-dynamic';

const bg = (iso: string) => iso.split('-').reverse().join('.');

export default async function RemindersPage() {
  const all = await getEnrichedExtinguishers();
  const due = all
    .filter((e) => (e.status.level === 'overdue' || e.status.level === 'soon') && e.status.nextDue)
    .sort((a, b) => (a.status.daysUntil ?? 0) - (b.status.daysUntil ?? 0));

  return (
    <div className="wrap">
      <Link href="/" className="back">← Табло</Link>
      <div className="sec-h"><h2>Напомняния</h2><div className="meta">{due.length}</div></div>
      {due.length === 0 && <div className="hint">Няма предстоящи или просрочени падежи.</div>}
      {due.map((e) => (
        <div key={e.id} className={`ext ${e.status.level}`} style={{ display: 'block' }}>
          <div className="main">
            <div className="nm">{e.model ?? 'Пожарогасител'} № {e.serial_number}</div>
            <div className="meta">
              <span>{e.clientName} · {e.siteName}</span>
              <span className={`chip ${e.status.level === 'overdue' ? 'over' : e.status.level}`}>{e.status.label}</span>
              {e.status.nextDue && <span>срок {bg(e.status.nextDue)}</span>}
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <ReminderButton
              clientName={e.clientName}
              siteName={e.siteName}
              model={e.model}
              serial={e.serial_number}
              action={e.status.dueAction}
              nextDue={e.status.nextDue as string}
              overdue={e.status.level === 'overdue'}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Линк от таблото** — в `src/app/page.tsx` добави видим линк/бутон към `/napomnyania` (до съществуващите навигации към `/skan` и `/kalendar`).
- [ ] **Step 4: tsc + lint + build** → 0/0.
- [ ] **Step 5: Commit** → `git add src/components/ReminderButton.tsx src/app/napomnyania/page.tsx src/app/page.tsx && git commit -m "feat(notify): reminders page + send button + dashboard link"`

---

## Self-Review
- **Spec покритие (Компонент 4):** екран с падежи ✓; изпращане през Hermes/Telegram (адаптер) + fallback преглед ✓; без OpenAI ключ ✓.
- **Без placeholder-и:** целият код е наличен.
- **Type консистентност:** `ReminderItem`/`action` ('TO'|'recharge'|'HI'|null) съвпада с `dueAction` от `status.ts`.

## Зависимост за по-късно
`HERMES_NOTIFY_URL` във Vercel → реално изпращане през Telegram (Hermes). Договор: `POST {text}` → 200.
