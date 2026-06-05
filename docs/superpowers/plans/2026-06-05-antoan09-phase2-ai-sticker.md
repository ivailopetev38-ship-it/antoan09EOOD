# Антоан-09 Демо-кръг 2 · Фаза 2: AI стикер → протокол — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Качване на снимка на стикер → разпознаване (провайдър-агностично, през Hermes; демо-fallback дотогава) → статус → попълнен протокол (Word), плюс ръчен избор.

**Architecture:** `VisionProvider` интерфейс с два адаптера: „hermes" (POST base64 към `HERMES_VISION_URL`) и „fallback" (детерминиран демо-резултат със сериен №, който съвпада с реален гасител в базата → целият поток е реален без OpenAI ключ). Чисто мапване стикер→двигател (тестваемо). Route намира гасителя по сериен № и връща статус + връзка за протокол. UI на `/skan` (качване) + на картата.

**Tech Stack:** Next.js 16 route handlers, TypeScript, Vitest. Без OpenAI ключ. Без Storage (праща се base64).

**Спец:** `docs/.../specs/2026-06-05-antoan09-demo-round2-design.md` (Компонент 2).

**Референции (съществуващ код):**
- Двигател: `computeExtinguisherStatus(EngineInput)` → `EngineResult` (`src/lib/regulatory/engine.ts`, типове в `types.ts`).
- UI статус: `deriveStatus(EngineResult, today)` (`src/lib/dashboard/status.ts`).
- Данни: `getExtinguisher(id)` (`src/lib/dashboard/queries.ts`) връща карта+статус+обект.
- Протокол: `GET /api/protocols/generate?siteId=&extinguisherId=` (вече работи).
- Scan UI: `src/app/skan/page.tsx` (client).
- Auth токен за Hermes: `HERMES_API_TOKEN` (preизползва се за vision адаптера).

---

## File Structure
- Create: `src/lib/vision/types.ts` — `StickerFields`, `RecognizeResult`, `VisionProvider`.
- Create: `src/lib/vision/map.ts` + `map.test.ts` — `stampsToHistory`, `stickerToEngineInput` (pure).
- Create: `src/lib/vision/provider.ts` — `getVisionProvider()` (hermes + fallback).
- Create: `src/app/api/vision/sticker/route.ts` — `POST {imageBase64}`.
- Create: `src/components/StickerScan.tsx` — качване + резултат + протокол (client).
- Modify: `src/app/skan/page.tsx` — добави `<StickerScan/>` под QR скенера.
- Modify: `src/app/pg/[id]/page.tsx` — добави линк „Сканирай стикер" към `/skan`.

---

## Task 1: Vision типове + провайдър

**Files:** Create `src/lib/vision/types.ts`, `src/lib/vision/provider.ts`

- [ ] **Step 1: Типове**

`src/lib/vision/types.ts`:
```ts
import type { ExtinguisherType } from '@/lib/regulatory/types';

export interface StickerFields {
  brand: string | null;
  model: string | null;
  serial: string | null;
  year: number | null;
  type: ExtinguisherType | null;
  capacityKg: number | null;
  agent: string | null;
  stamps: { kind: 'TO' | 'recharge' | 'HI'; date: string }[];
  scrapYear: number | null;
}

export interface RecognizeResult {
  fields: StickerFields;
  confidence: number;
  demo: boolean;
  raw?: string;
}

export interface VisionProvider {
  recognize(imageBase64: string): Promise<RecognizeResult>;
}
```

- [ ] **Step 2: Провайдър (hermes адаптер + fallback)**

`src/lib/vision/provider.ts`:
```ts
import type { VisionProvider, RecognizeResult } from './types';

const DEMO: RecognizeResult = {
  demo: true,
  confidence: 0.66,
  fields: {
    brand: 'Sparky',
    model: 'Спарк 6 кг',
    serial: '0036',
    year: 2022,
    type: 'powder_abc',
    capacityKg: 6,
    agent: 'Кобра ABC 50',
    stamps: [{ kind: 'TO', date: '2025-12-01' }, { kind: 'recharge', date: '2025-12-01' }],
    scrapYear: 2037,
  },
};

function hermesProvider(url: string, token: string): VisionProvider {
  return {
    async recognize(imageBase64: string): Promise<RecognizeResult> {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64, task: 'extinguisher_sticker', schemaVersion: 1 }),
      });
      if (!res.ok) throw new Error(`Hermes vision ${res.status}`);
      const json = (await res.json()) as { fields: RecognizeResult['fields']; confidence?: number; raw?: string };
      return { fields: json.fields, confidence: json.confidence ?? 0.8, demo: false, raw: json.raw };
    },
  };
}

function fallbackProvider(): VisionProvider {
  return { async recognize(): Promise<RecognizeResult> { return DEMO; } };
}

export function getVisionProvider(): VisionProvider {
  const url = process.env.HERMES_VISION_URL;
  const token = process.env.HERMES_API_TOKEN ?? '';
  return url ? hermesProvider(url, token) : fallbackProvider();
}
```

- [ ] **Step 3: Commit**
```bash
git add src/lib/vision/types.ts src/lib/vision/provider.ts
git commit -m "feat(vision): provider interface + hermes adapter + demo fallback"
```

---

## Task 2: Мапване стикер → двигател (pure, TDD)

**Files:** Create `src/lib/vision/map.ts`, `src/lib/vision/map.test.ts`

- [ ] **Step 1: Тест**

`src/lib/vision/map.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { stampsToHistory, stickerToEngineInput } from './map';
import type { StickerFields } from './types';

const base: StickerFields = {
  brand: 'Sparky', model: 'Спарк 6 кг', serial: '0036', year: 2022,
  type: 'powder_abc', capacityKg: 6, agent: 'Кобра ABC 50',
  stamps: [{ kind: 'TO', date: '2024-12-01' }, { kind: 'TO', date: '2025-12-01' }, { kind: 'recharge', date: '2025-12-01' }],
  scrapYear: 2037,
};

describe('stampsToHistory', () => {
  it('взима най-късната дата по тип', () => {
    expect(stampsToHistory(base.stamps)).toEqual({ lastTO: '2025-12-01', lastRecharge: '2025-12-01', lastHI: null });
  });
  it('празно → null', () => {
    expect(stampsToHistory([])).toEqual({ lastTO: null, lastRecharge: null, lastHI: null });
  });
});

describe('stickerToEngineInput', () => {
  it('строи вход за двигателя', () => {
    const inp = stickerToEngineInput(base, '2026-06-05');
    expect(inp).toMatchObject({ type: 'powder_abc', manufactureYear: 2022, stampYear: 2037, lastTO: '2025-12-01', today: '2026-06-05' });
  });
  it('връща null без тип или година', () => {
    expect(stickerToEngineInput({ ...base, type: null }, '2026-06-05')).toBeNull();
    expect(stickerToEngineInput({ ...base, year: null }, '2026-06-05')).toBeNull();
  });
});
```

- [ ] **Step 2: Run → fail**
Run: `npx vitest run src/lib/vision/map.test.ts` → FAIL (no module).

- [ ] **Step 3: Имплементация**

`src/lib/vision/map.ts`:
```ts
import type { EngineInput } from '@/lib/regulatory/types';
import type { StickerFields } from './types';

export function stampsToHistory(stamps: StickerFields['stamps']): {
  lastTO: string | null; lastRecharge: string | null; lastHI: string | null;
} {
  const h = { lastTO: null as string | null, lastRecharge: null as string | null, lastHI: null as string | null };
  for (const s of stamps) {
    if (s.kind === 'TO') { if (!h.lastTO || s.date > h.lastTO) h.lastTO = s.date; }
    else if (s.kind === 'recharge') { if (!h.lastRecharge || s.date > h.lastRecharge) h.lastRecharge = s.date; }
    else if (s.kind === 'HI') { if (!h.lastHI || s.date > h.lastHI) h.lastHI = s.date; }
  }
  return h;
}

export function stickerToEngineInput(f: StickerFields, today: string): EngineInput | null {
  if (!f.type || !f.year) return null;
  const h = stampsToHistory(f.stamps);
  return {
    type: f.type,
    manufactureYear: f.year,
    stampYear: f.scrapYear,
    lastTO: h.lastTO,
    lastRecharge: h.lastRecharge,
    lastHI: h.lastHI,
    today,
  };
}
```

- [ ] **Step 4: Run → pass.** Run: `npx vitest run src/lib/vision/map.test.ts` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/vision/map.ts src/lib/vision/map.test.ts
git commit -m "feat(vision): pure sticker→engine mapping + tests"
```

---

## Task 3: API `/api/vision/sticker`

**Files:** Create `src/app/api/vision/sticker/route.ts`

- [ ] **Step 1: Route**

`src/app/api/vision/sticker/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getVisionProvider } from '@/lib/vision/provider';
import { stickerToEngineInput } from '@/lib/vision/map';
import { computeExtinguisherStatus } from '@/lib/regulatory/engine';
import { deriveStatus } from '@/lib/dashboard/status';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { imageBase64?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Невалиден JSON' }, { status: 400 }); }
  if (!body.imageBase64) return NextResponse.json({ ok: false, error: 'Липсва снимка' }, { status: 400 });

  let rec;
  try { rec = await getVisionProvider().recognize(body.imageBase64); }
  catch (e) { return NextResponse.json({ ok: false, error: `Грешка при разпознаване: ${(e as Error).message}` }, { status: 502 }); }

  const today = new Date().toISOString().slice(0, 10);
  const f = rec.fields;

  // Намери гасителя по сериен № (за реален статус + протокол)
  let match: { id: string; siteId: string; siteName: string; label: string } | null = null;
  if (f.serial) {
    const db = createServiceClient();
    const { data } = await db
      .from('extinguishers')
      .select('id, site_id, sites(name)')
      .ilike('serial_number', f.serial)
      .limit(1)
      .maybeSingle();
    if (data) {
      const site = (data as { sites?: { name?: string } | { name?: string }[] }).sites;
      const siteName = (Array.isArray(site) ? site[0]?.name : site?.name) ?? '';
      match = { id: data.id, siteId: data.site_id, siteName, label: '' };
    }
  }

  // Статус от стикера (за показване дори без съвпадение)
  const inp = stickerToEngineInput(f, today);
  const status = inp ? deriveStatus(computeExtinguisherStatus(inp), today) : null;

  return NextResponse.json({ ok: true, demo: rec.demo, confidence: rec.confidence, fields: f, match, status });
}
```

- [ ] **Step 2: Type-check.** Run: `npx tsc --noEmit` → 0.

- [ ] **Step 3: Тест (dev сървър на 3100)**
```powershell
$b = @{ imageBase64 = 'demo' } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3100/api/vision/sticker -Method POST -ContentType 'application/json' -Body $b
```
Expected: `ok=True, demo=True, fields.serial=0036, match` (съвпада с реалния 0036), `status.level`.

- [ ] **Step 4: Commit**
```bash
git add src/app/api/vision/sticker/route.ts
git commit -m "feat(vision): POST /api/vision/sticker (recognize + match + status)"
```

---

## Task 4: UI компонент `StickerScan` + закачане на `/skan`

**Files:** Create `src/components/StickerScan.tsx`; Modify `src/app/skan/page.tsx`

- [ ] **Step 1: Компонент** (качване → разпознаване → резултат + протокол)

`src/components/StickerScan.tsx`:
```tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';

interface Resp {
  ok: boolean; demo?: boolean; confidence?: number;
  fields?: { brand: string | null; model: string | null; serial: string | null; year: number | null; type: string | null; capacityKg: number | null };
  match?: { id: string; siteId: string; siteName: string } | null;
  status?: { level: string; label: string } | null;
  error?: string;
}

const LEVEL_CLASS: Record<string, string> = { ok: 'ok', soon: 'soon', overdue: 'over', scrap: 'scrap' };

export default function StickerScan() {
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<Resp | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResp(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      const base64 = dataUrl.split(',')[1] ?? '';
      setBusy(true);
      try {
        const r = await fetch('/api/vision/sticker', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 }),
        });
        setResp(await r.json());
      } catch { setResp({ ok: false, error: 'Грешка при заявката' }); }
      finally { setBusy(false); }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="scan-box" style={{ marginTop: 16 }}>
      <h3 style={{ marginBottom: 8 }}>AI разпознаване по снимка</h3>
      <p className="hint">Качи или снимай стикера на пожарогасителя.</p>
      <input type="file" accept="image/*" capture="environment" onChange={onFile} disabled={busy} />
      {preview && <img src={preview} alt="стикер" style={{ maxWidth: 220, marginTop: 12, borderRadius: 8 }} />}
      {busy && <p className="hint">Разпознаване…</p>}

      {resp?.ok && resp.fields && (
        <div style={{ marginTop: 16 }}>
          {resp.demo && <p className="hint" style={{ color: 'var(--soon)' }}>⚠ демо разпознаване (Hermes още не е вързан)</p>}
          <p><b>{resp.fields.model ?? resp.fields.brand ?? 'Пожарогасител'}</b> № {resp.fields.serial ?? '—'} / {resp.fields.year ?? '—'}</p>
          {resp.status && <p>Статус: <span className={`badge ${LEVEL_CLASS[resp.status.level] ?? ''}`}>{resp.status.label}</span></p>}
          {resp.match ? (
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              <Link className="btn" href={`/pg/${resp.match.id}`}>Виж картата ({resp.match.siteName})</Link>
              <a className="btn" href={`/api/protocols/generate?siteId=${resp.match.siteId}&extinguisherId=${resp.match.id}`}>Генерирай протокол (Word)</a>
            </div>
          ) : (
            <p className="hint" style={{ marginTop: 8 }}>Няма съвпадение по сериен № в базата. Можеш да го добавиш ръчно.</p>
          )}
        </div>
      )}
      {resp && !resp.ok && <p className="hint" style={{ color: 'var(--over)' }}>{resp.error}</p>}

      <p className="hint" style={{ marginTop: 16 }}>или <Link href="/">избери ръчно от обектите →</Link></p>
    </div>
  );
}
```

- [ ] **Step 2: Закачи в `/skan`**

В `src/app/skan/page.tsx`: добави импорт `import StickerScan from '@/components/StickerScan';` и постави `<StickerScan />` веднага след затварящия таг на блока с QR скенера (преди затварящия `</div>` на `.wrap`).

- [ ] **Step 3: Lint + build.** Run: `npm run lint; npm run build` → 0/0.

- [ ] **Step 4: E2E (dev 3100):** отвори `/skan`, качи произволна снимка → виж демо-резултат (0036) + статус + бутони. Натисни „Генерирай протокол" → сваля Word.

- [ ] **Step 5: Commit**
```bash
git add src/components/StickerScan.tsx src/app/skan/page.tsx
git commit -m "feat(vision): sticker upload UI on /skan (preview, status, protocol)"
```

---

## Task 5: Линк на картата `/pg/[id]`

**Files:** Modify `src/app/pg/[id]/page.tsx`

- [ ] **Step 1:** Добави видим линк „📸 Сканирай стикер" към `/skan` в горната част на картата (до съществуващите действия). Запази стила (`className="btn"` или съществуващите класове на страницата).

- [ ] **Step 2: Lint + build** → 0/0.

- [ ] **Step 3: Commit**
```bash
git add src/app/pg/[id]/page.tsx
git commit -m "feat(vision): link to sticker scan from extinguisher card"
```

---

## Self-Review
- **Spec покритие (Компонент 2):** снимка на сайта ✓ (`/skan`) + линк от картата ✓; разпознаване през Hermes (адаптер) + fallback ✓; статус през двигателя ✓; протокол Word (reuse) ✓; ръчен избор (линк към обектите) ✓; без OpenAI ключ ✓.
- **Без placeholder-и:** целият код е наличен.
- **Type консистентност:** `StickerFields`/`RecognizeResult` еднакви в provider/map/route; `EngineInput` от regulatory; `deriveStatus` сигнатура спазена.
- **Демо без Hermes:** fallback връща сериен 0036 → съвпада с реален гасител → реален статус + реален Word протокол.

## Зависимост за по-късно (сървър/Hermes)
Когато Hermes vision endpoint е готов: задай `HERMES_VISION_URL` във Vercel → адаптерът поема, fallback-ът се изключва автоматично. Договор: `POST {imageBase64} → { fields: StickerFields, confidence, raw }`.
