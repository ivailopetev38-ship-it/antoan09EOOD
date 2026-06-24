'use client';
import { useState } from 'react';

interface Props {
  siteId: string;
  extinguisherId: string;
  clientName: string;
  siteName: string;
  model: string | null;
  serial: string | null;
}

function plusYears(y: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + y);
  return d.toISOString().slice(0, 10);
}
const bg = (iso: string) => iso.split('-').reverse().join('.');

export default function ScheduleReminder(p: Props) {
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function schedule(due: string) {
    if (!due) { setMsg('Избери дата.'); return; }
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/reminders/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: p.siteId, extinguisherId: p.extinguisherId,
          clientName: p.clientName, siteName: p.siteName,
          model: p.model, serial: p.serial, dueDate: due,
        }),
      });
      const j = await r.json();
      setMsg(j.ok ? `✓ Насрочено за ${bg(due)}` : `✗ ${j.error ?? 'Грешка'}`);
    } catch {
      setMsg('✗ Мрежова грешка');
    } finally {
      setBusy(false);
    }
  }

  const btn: React.CSSProperties = { border: '1px solid var(--line2)', color: 'inherit' };
  return (
    <div style={{ marginTop: 8 }}>
      <p className="hint" style={{ margin: '0 0 6px' }}>📅 Насрочи напомняне за повторно обслужване:</p>
      <div className="btn-row" style={{ marginTop: 0, flexWrap: 'wrap', gap: 8 }}>
        <button className="btn" style={btn} disabled={busy} onClick={() => schedule(plusYears(1))}>След 1 година</button>
        <button className="btn" style={btn} disabled={busy} onClick={() => schedule(plusYears(2))}>След 2 години</button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ fontSize: 16 }} />
        <button className="btn" style={btn} disabled={busy || !date} onClick={() => schedule(date)}>Насрочи на дата</button>
      </div>
      {msg && <p className="hint" style={{ marginTop: 6, color: msg.startsWith('✓') ? 'var(--ok)' : 'var(--soon)' }}>{msg}</p>}
    </div>
  );
}
