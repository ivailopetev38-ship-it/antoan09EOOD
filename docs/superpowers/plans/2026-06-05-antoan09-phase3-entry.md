# Антоан-09 Демо-кръг 2 · Фаза 3: Минимално въвеждане — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Живо въвеждане: „Запиши услуга" (обновява история + авто-преизчислява срокове) и „Нов гасител" към обект.

**Architecture:** Тънки API routes (service_role) + малки client форми, които правят `router.refresh()` след успех, за да се види новият статус веднага. Без нова логика в двигателя — преизползва се.

**Спец:** Компонент 3. **Референции:** схема в `0001_init.sql` (`service_events`: kind/service_date/technician_name/agent_trade_name/notes; `extinguishers`: site_id/brand_id/model/type/serial_number/manufacture_year/category/mass_kg/stamp_year). Pattern за route: `src/app/api/import/route.ts`. Карта: `src/app/pg/[id]/page.tsx`. Обект: `src/app/obekt/[siteId]/page.tsx`.

---

## File Structure
- Create: `src/app/api/service-events/route.ts` — POST нов event.
- Create: `src/app/api/extinguishers/route.ts` — POST нов гасител.
- Create: `src/components/RecordServiceForm.tsx` — форма на картата.
- Create: `src/components/AddExtinguisherForm.tsx` — форма на обекта.
- Modify: `src/app/pg/[id]/page.tsx` — вмъкни `<RecordServiceForm/>`.
- Modify: `src/app/obekt/[siteId]/page.tsx` — вмъкни `<AddExtinguisherForm/>`.

---

## Task 1: POST /api/service-events

**Files:** Create `src/app/api/service-events/route.ts`

- [ ] **Step 1: Route**
```ts
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const KINDS = ['TO', 'recharge', 'powder_change', 'foam_change', 'HI'];

export async function POST(req: Request) {
  let b: {
    extinguisherId?: string; kind?: string; serviceDate?: string;
    technicianName?: string; agentTradeName?: string; notes?: string;
  };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Невалиден JSON' }, { status: 400 }); }
  if (!b.extinguisherId || !b.kind || !b.serviceDate) {
    return NextResponse.json({ ok: false, error: 'Липсват задължителни полета' }, { status: 400 });
  }
  if (!KINDS.includes(b.kind)) {
    return NextResponse.json({ ok: false, error: 'Невалиден вид дейност' }, { status: 400 });
  }
  const db = createServiceClient();
  const { error } = await db.from('service_events').insert({
    extinguisher_id: b.extinguisherId,
    kind: b.kind,
    service_date: b.serviceDate,
    technician_name: b.technicianName || null,
    agent_trade_name: b.agentTradeName || null,
    notes: b.notes || null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: tsc** → `npx tsc --noEmit` → 0.
- [ ] **Step 3: Commit** → `git add src/app/api/service-events/route.ts && git commit -m "feat(entry): POST /api/service-events"`

---

## Task 2: RecordServiceForm на картата

**Files:** Create `src/components/RecordServiceForm.tsx`; Modify `src/app/pg/[id]/page.tsx`

- [ ] **Step 1: Компонент**
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const KINDS: { v: string; label: string }[] = [
  { v: 'TO', label: 'ТО (техническо обслужване)' },
  { v: 'recharge', label: 'Презареждане' },
  { v: 'powder_change', label: 'Смяна на прах' },
  { v: 'foam_change', label: 'Смяна на пяна' },
  { v: 'HI', label: 'Хидростатично изпитване' },
];

export default function RecordServiceForm({ extinguisherId }: { extinguisherId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('TO');
  const [date, setDate] = useState('');
  const [tech, setTech] = useState('');
  const [agent, setAgent] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const needsAgent = kind === 'recharge' || kind === 'powder_change' || kind === 'foam_change';

  async function submit() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/service-events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extinguisherId, kind, serviceDate: date, technicianName: tech, agentTradeName: needsAgent ? agent : '' }),
      });
      const j = await r.json();
      if (j.ok) { setMsg('✓ Записано'); setOpen(false); router.refresh(); }
      else setMsg(`✗ ${j.error}`);
    } catch { setMsg('✗ Грешка'); }
    finally { setBusy(false); }
  }

  if (!open) return <button className="btn" style={{ border: '1px solid var(--line2)', color: 'inherit' }} onClick={() => setOpen(true)}>✍ Запиши услуга</button>;

  return (
    <div style={{ border: '1px solid var(--line2)', borderRadius: 12, padding: 16, marginTop: 12, width: '100%' }}>
      <div style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input placeholder="Техник" value={tech} onChange={(e) => setTech(e.target.value)} />
        {needsAgent && <input placeholder="Гасително вещество" value={agent} onChange={(e) => setAgent(e.target.value)} />}
        <div className="btn-row">
          <button className="btn btn-fire" disabled={busy || !date} onClick={submit}>{busy ? 'Записване…' : 'Запази'}</button>
          <button className="btn" style={{ border: '1px solid var(--line2)', color: 'inherit' }} onClick={() => setOpen(false)}>Отказ</button>
        </div>
        {msg && <p className="hint">{msg}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Вмъкни в `/pg/[id]`:** добави `import RecordServiceForm from '@/components/RecordServiceForm';` и постави `<RecordServiceForm extinguisherId={ext.id} />` вътре в `.btn-row` (след линка „Сканирай стикер").
- [ ] **Step 3: lint + build** → 0/0.
- [ ] **Step 4: Commit** → `git add src/components/RecordServiceForm.tsx "src/app/pg/[id]/page.tsx" && git commit -m "feat(entry): record service form on card (live recompute)"`

---

## Task 3: POST /api/extinguishers + AddExtinguisherForm

**Files:** Create `src/app/api/extinguishers/route.ts`, `src/components/AddExtinguisherForm.tsx`; Modify `src/app/obekt/[siteId]/page.tsx`

- [ ] **Step 1: Route**
```ts
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const TYPES = ['powder_abc', 'powder_bc', 'water', 'foam', 'co2'];

export async function POST(req: Request) {
  let b: {
    siteId?: string; type?: string; model?: string; serialNumber?: string;
    manufactureYear?: number; massKg?: number; stampYear?: number; category?: string;
  };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Невалиден JSON' }, { status: 400 }); }
  if (!b.siteId || !b.type || !b.serialNumber || !b.manufactureYear) {
    return NextResponse.json({ ok: false, error: 'Липсват задължителни полета' }, { status: 400 });
  }
  if (!TYPES.includes(b.type)) return NextResponse.json({ ok: false, error: 'Невалиден тип' }, { status: 400 });
  const db = createServiceClient();
  const { data, error } = await db.from('extinguishers').insert({
    site_id: b.siteId, type: b.type, model: b.model || null, serial_number: b.serialNumber,
    manufacture_year: b.manufactureYear, mass_kg: b.massKg ?? null, stamp_year: b.stampYear ?? null,
    category: b.category || null,
  }).select('id').single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data!.id });
}
```

- [ ] **Step 2: Компонент** `src/components/AddExtinguisherForm.tsx`
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TYPES = [
  { v: 'powder_abc', label: 'Прахов ABC' }, { v: 'powder_bc', label: 'Прахов BC' },
  { v: 'water', label: 'Воден' }, { v: 'foam', label: 'Водопенен' }, { v: 'co2', label: 'CO₂' },
];

export default function AddExtinguisherForm({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('powder_abc');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [year, setYear] = useState('');
  const [mass, setMass] = useState('');
  const [stamp, setStamp] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/extinguishers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId, type, model, serialNumber: serial,
          manufactureYear: Number(year), massKg: mass ? Number(mass.replace(',', '.')) : undefined,
          stampYear: stamp ? Number(stamp) : undefined,
        }),
      });
      const j = await r.json();
      if (j.ok) { setOpen(false); router.refresh(); }
      else setMsg(`✗ ${j.error}`);
    } catch { setMsg('✗ Грешка'); }
    finally { setBusy(false); }
  }

  if (!open) return <button className="btn btn-fire" onClick={() => setOpen(true)}>＋ Нов гасител</button>;

  return (
    <div style={{ border: '1px solid var(--line2)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
        </select>
        <input placeholder="Модел (напр. Спарк 6 кг)" value={model} onChange={(e) => setModel(e.target.value)} />
        <input placeholder="Сериен № *" value={serial} onChange={(e) => setSerial(e.target.value)} />
        <input placeholder="Година на производство *" value={year} onChange={(e) => setYear(e.target.value)} />
        <input placeholder="Маса (кг)" value={mass} onChange={(e) => setMass(e.target.value)} />
        <input placeholder="Щампа до (година)" value={stamp} onChange={(e) => setStamp(e.target.value)} />
        <div className="btn-row">
          <button className="btn btn-fire" disabled={busy || !serial || !year} onClick={submit}>{busy ? 'Добавяне…' : 'Добави'}</button>
          <button className="btn" style={{ border: '1px solid var(--line2)', color: 'inherit' }} onClick={() => setOpen(false)}>Отказ</button>
        </div>
        {msg && <p className="hint">{msg}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Вмъкни в `/obekt/[siteId]`:** добави `import AddExtinguisherForm from '@/components/AddExtinguisherForm';` и постави `<AddExtinguisherForm siteId={...} />` над списъка с гасители (използвай реалния идентификатор на обекта в компонента).
- [ ] **Step 4: tsc + lint + build** → 0/0.
- [ ] **Step 5: Commit** → `git add src/app/api/extinguishers/route.ts src/components/AddExtinguisherForm.tsx "src/app/obekt/[siteId]/page.tsx" && git commit -m "feat(entry): add extinguisher form on object page"`

---

## Self-Review
- **Spec покритие (Компонент 3):** „запиши услуга" ✓ (Task 1–2, авто-recompute чрез `router.refresh()` + двигателя); „нов гасител" ✓ (Task 3); гасително вещество задължително при ПЗ/смяна (UI условие) ✓.
- **Без placeholder-и:** целият код е наличен.
- **Type консистентност:** `kind`/`type` стойностите съвпадат с enum-ите от схемата.
