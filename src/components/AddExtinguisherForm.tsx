'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deriveCategory } from '@/lib/regulatory/category';
import type { ExtinguisherType } from '@/lib/regulatory/types';

const CAT_OPTS = ['К1', 'К2', 'К5']; // К1 водопенни/водни · К2 прахови · К5 въглеродни

const TYPES = [
  { v: 'powder_abc', label: 'Прахов ABC' },
  { v: 'powder_bc', label: 'Прахов BC' },
  { v: 'water', label: 'Воден' },
  { v: 'foam', label: 'Водопенен' },
  { v: 'co2', label: 'CO₂' },
];

export default function AddExtinguisherForm({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('powder_abc');
  const [category, setCategory] = useState<string>(deriveCategory('powder_abc'));
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [year, setYear] = useState('');
  const [mass, setMass] = useState('');
  const [grossMass, setGrossMass] = useState('');
  const [stamp, setStamp] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/extinguishers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          type,
          model,
          serialNumber: serial,
          manufactureYear: Number(year),
          massKg: mass ? Number(mass.replace(',', '.')) : undefined,
          grossMassKg: grossMass ? Number(grossMass.replace(',', '.')) : undefined,
          stampYear: stamp ? Number(stamp) : undefined,
          category: category || undefined,
        }),
      });
      const j = await r.json();
      if (j.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setMsg(`✗ ${j.error}`);
      }
    } catch {
      setMsg('✗ Грешка');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn-fire" onClick={() => setOpen(true)}>
        ＋ Нов гасител
      </button>
    );
  }

  return (
    <div style={{ border: '1px solid var(--line2)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
        <select value={type} onChange={(e) => { setType(e.target.value); setCategory(deriveCategory(e.target.value as ExtinguisherType)); }}>
          {TYPES.map((t) => (
            <option key={t.v} value={t.v}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="hint" style={{ display: 'grid', gap: 4 }}>
          Категория (по БДС ISO 11602-2 — редактирай при нужда)
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CAT_OPTS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <input placeholder="Модел (напр. Спарк 6 кг)" value={model} onChange={(e) => setModel(e.target.value)} />
        <input placeholder="Сериен № *" value={serial} onChange={(e) => setSerial(e.target.value)} />
        <input placeholder="Година на производство *" value={year} onChange={(e) => setYear(e.target.value)} />
        <input placeholder="Маса на веществото (кг)" value={mass} onChange={(e) => setMass(e.target.value)} />
        <input placeholder="Обща маса / бруто (кг) — графа 4" value={grossMass} onChange={(e) => setGrossMass(e.target.value)} />
        <input placeholder="Щампа до (година)" value={stamp} onChange={(e) => setStamp(e.target.value)} />
        <div className="btn-row">
          <button className="btn btn-fire" disabled={busy || !serial || !year} onClick={submit}>
            {busy ? 'Добавяне…' : 'Добави'}
          </button>
          <button className="btn" style={{ border: '1px solid var(--line2)', color: 'inherit' }} onClick={() => setOpen(false)}>
            Отказ
          </button>
        </div>
        {msg && <p className="hint">{msg}</p>}
      </div>
    </div>
  );
}
