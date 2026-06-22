'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function NewSitePage() {
  const [siteName, setSiteName] = useState('');
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!siteName.trim() || !clientName.trim()) {
      setErr('Попълни име на обект и клиент.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName, siteName, address, phone, email }),
      });
      const j = await r.json();
      if (j.ok && j.siteId) {
        window.location.href = `/obekt/${j.siteId}`;
      } else {
        setErr(j.error || 'Неуспешно създаване');
      }
    } catch {
      setErr('Мрежова грешка');
    } finally {
      setBusy(false);
    }
  }

  const label: React.CSSProperties = { display: 'grid', gap: 6, fontSize: 13, color: 'var(--muted)' };

  return (
    <div className="wrap">
      <Link href="/" className="back">← Табло</Link>
      <div className="sec-h"><h2>🏢 Нов обект</h2></div>
      <p className="hint" style={{ marginBottom: 16 }}>Създай нов обект и неговия клиент. После добавяш гасителите чрез „Сканирай" или формата на обекта.</p>

      <form onSubmit={submit} style={{ display: 'grid', gap: 14, maxWidth: 460 }}>
        <label style={label}>Име на обект *
          <input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="напр. Склад №2" autoFocus />
        </label>
        <label style={label}>Клиент (собственик) *
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="напр. ЕТ Иванов" />
        </label>
        <label style={label}>Адрес
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="по избор" />
        </label>
        <label style={label}>Телефон
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="по избор" inputMode="tel" />
        </label>
        <label style={label}>Имейл (за изпращане на протоколи)
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="по избор — напр. klient@firma.bg" inputMode="email" />
        </label>
        {err && <p className="hint" style={{ color: 'var(--over)' }}>{err}</p>}
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button className="btn btn-fire" type="submit" disabled={busy}>{busy ? 'Създаване…' : 'Създай обект'}</button>
          <Link className="btn" href="/admin/import" style={{ border: '1px solid var(--line2)', color: 'inherit' }}>📥 Или импортирай списък</Link>
        </div>
      </form>
    </div>
  );
}
