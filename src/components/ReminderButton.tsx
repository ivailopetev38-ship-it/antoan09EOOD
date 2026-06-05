'use client';
import { useState } from 'react';

interface Props {
  clientName: string;
  siteName: string;
  model: string | null;
  serial: string | null;
  action: 'TO' | 'recharge' | 'HI' | null;
  nextDue: string;
  overdue: boolean;
}

export default function ReminderButton(p: Props) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ sent: boolean; preview: string } | null>(null);

  async function send() {
    setBusy(true);
    try {
      const r = await fetch('/api/reminders/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      const j = await r.json();
      if (j.ok) setRes({ sent: j.sent, preview: j.preview });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        className="btn"
        style={{ border: '1px solid var(--line2)', color: 'inherit' }}
        disabled={busy}
        onClick={send}
      >
        {busy ? '…' : '🔔 Изпрати напомняне'}
      </button>
      {res && (
        <div style={{ marginTop: 8, padding: 10, border: '1px solid var(--line2)', borderRadius: 10 }}>
          <p className="hint" style={{ color: res.sent ? 'var(--ok)' : 'var(--soon)' }}>
            {res.sent
              ? '✓ Изпратено през Telegram'
              : '👁 Преглед (Hermes не е вързан — текстът, който ще се изпрати):'}
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, margin: '6px 0 0' }}>{res.preview}</pre>
        </div>
      )}
    </div>
  );
}
