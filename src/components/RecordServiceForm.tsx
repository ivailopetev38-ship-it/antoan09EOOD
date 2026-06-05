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
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/service-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extinguisherId,
          kind,
          serviceDate: date,
          technicianName: tech,
          agentTradeName: needsAgent ? agent : '',
        }),
      });
      const j = await r.json();
      if (j.ok) {
        setMsg('✓ Записано');
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
      <button className="btn" style={{ border: '1px solid var(--line2)', color: 'inherit' }} onClick={() => setOpen(true)}>
        ✍ Запиши услуга
      </button>
    );
  }

  return (
    <div style={{ border: '1px solid var(--line2)', borderRadius: 12, padding: 16, marginTop: 12, width: '100%' }}>
      <div style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => (
            <option key={k.v} value={k.v}>
              {k.label}
            </option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input placeholder="Техник" value={tech} onChange={(e) => setTech(e.target.value)} />
        {needsAgent && (
          <input placeholder="Гасително вещество" value={agent} onChange={(e) => setAgent(e.target.value)} />
        )}
        <div className="btn-row">
          <button className="btn btn-fire" disabled={busy || !date} onClick={submit}>
            {busy ? 'Записване…' : 'Запази'}
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
