'use client';
import { useState } from 'react';

const PLACEHOLDER = `клиент\tобект\tмарка\tмодел\tсериен\tтип\tкапацитет\tгодина\tщампа\tпоследно_ТО\tпоследно_ПЗ\tпоследно_ХИ\tтехник\tзабележки
ЕТ Орлов\tСкладове Дунав\tSparky\tСпарк 6 кг\t0036\tпрахов ABC\t6 кг\t2022\t2037\t01.12.2025\t01.12.2025\t\tП. Петров\t`;

interface ImportResp {
  ok: boolean;
  parsed?: number;
  errors?: { line: number; message: string }[];
  summary?: { clients: number; sites: number; extinguishers: number; events: number };
  error?: string;
}

export default function ImportPage() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<ImportResp | null>(null);

  async function submit() {
    setBusy(true);
    setResp(null);
    try {
      const r = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      setResp(await r.json());
    } catch {
      setResp({ ok: false, error: 'Грешка при заявката' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Импорт на пожарогасители</h1>
      <p style={{ opacity: 0.7, marginBottom: 16 }}>
        Постави таблица — копирана от Excel (табове) или CSV с разделител точка-и-запетая. Първият ред са заглавията.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={12}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, padding: 12 }}
      />
      <button
        onClick={submit}
        disabled={busy || !text.trim()}
        style={{ marginTop: 12, padding: '10px 20px' }}
      >
        {busy ? 'Импортиране…' : 'Импортирай'}
      </button>

      {resp && (
        <div style={{ marginTop: 20 }}>
          {resp.ok ? (
            <p style={{ color: 'green' }}>
              ✓ Импортирани {resp.parsed} реда — нови: клиенти {resp.summary?.clients}, обекти{' '}
              {resp.summary?.sites}, гасители {resp.summary?.extinguishers}, събития {resp.summary?.events}.
            </p>
          ) : (
            <p style={{ color: 'crimson' }}>✗ {resp.error ?? 'Има грешки'}</p>
          )}
          {!!resp.errors?.length && (
            <ul style={{ color: 'crimson', marginTop: 8 }}>
              {resp.errors.map((e, i) => (
                <li key={i}>
                  Ред {e.line}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
