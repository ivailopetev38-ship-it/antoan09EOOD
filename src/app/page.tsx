'use client';
import { useState } from 'react';

const DEMO_SITE_ID = '22222222-2222-2222-2222-222222222222';

export default function Home() {
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch('/api/protocols/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: DEMO_SITE_ID }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'protokol.docx';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>Антоан-09 · Протокол (демо)</h1>
      <p>Генерира протокол 1-към-1 за демо обект „Склад №1".</p>
      <button onClick={generate} disabled={busy} style={{ padding: '12px 24px', fontSize: 16 }}>
        {busy ? 'Генерирам…' : 'Генерирай протокол (Word)'}
      </button>
    </main>
  );
}
