'use client';
import { useState } from 'react';
import Link from 'next/link';

interface Resp {
  ok: boolean;
  demo?: boolean;
  confidence?: number;
  fields?: {
    brand: string | null;
    model: string | null;
    serial: string | null;
    year: number | null;
    type: string | null;
    capacityKg: number | null;
  };
  match?: { id: string; siteId: string; siteName: string } | null;
  status?: { level: string; label: string } | null;
  error?: string;
}

function chipClass(level?: string): string {
  if (level === 'overdue') return 'over';
  return level ?? '';
}

export default function StickerScan() {
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<Resp | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
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
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 }),
        });
        setResp(await r.json());
      } catch {
        setResp({ ok: false, error: 'Грешка при заявката' });
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="scan-box" style={{ marginTop: 22 }}>
      <div className="sec-h">
        <h2>AI разпознаване по снимка</h2>
      </div>
      <p className="hint">Качи или снимай стикера на пожарогасителя.</p>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFile}
        disabled={busy}
        style={{ marginTop: 10 }}
      />
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="стикер"
          style={{ maxWidth: 220, marginTop: 12, borderRadius: 10, display: 'block' }}
        />
      )}
      {busy && <p className="hint" style={{ marginTop: 10 }}>Разпознаване…</p>}

      {resp?.ok && resp.fields && (
        <div style={{ marginTop: 16 }}>
          {resp.demo && (
            <p className="hint" style={{ color: 'var(--soon)' }}>
              ⚠ демо разпознаване (Hermes още не е вързан)
            </p>
          )}
          <p style={{ fontWeight: 700, marginTop: 6 }}>
            {resp.fields.model ?? resp.fields.brand ?? 'Пожарогасител'} № {resp.fields.serial ?? '—'} /{' '}
            {resp.fields.year ?? '—'}
          </p>
          {resp.status && (
            <p style={{ marginTop: 8 }}>
              Статус: <span className={`chip ${chipClass(resp.status.level)}`}>{resp.status.label}</span>
            </p>
          )}
          {resp.match ? (
            <div className="btn-row">
              <a
                className="btn btn-fire"
                href={`/api/protocols/generate?siteId=${resp.match.siteId}&extinguisherId=${resp.match.id}`}
              >
                Генерирай протокол (Word)
              </a>
              <Link
                className="btn"
                href={`/pg/${resp.match.id}`}
                style={{ border: '1px solid var(--line2)', color: 'inherit' }}
              >
                Виж картата · {resp.match.siteName}
              </Link>
            </div>
          ) : (
            <p className="hint" style={{ marginTop: 10 }}>
              Няма съвпадение по сериен № в базата. Можеш да го добавиш ръчно.
            </p>
          )}
        </div>
      )}
      {resp && !resp.ok && (
        <p className="hint" style={{ color: 'var(--over)', marginTop: 10 }}>
          {resp.error}
        </p>
      )}

      <p className="hint" style={{ marginTop: 18 }}>
        или{' '}
        <Link href="/" style={{ color: 'var(--soon)' }}>
          избери ръчно от обектите →
        </Link>
      </p>
    </div>
  );
}
