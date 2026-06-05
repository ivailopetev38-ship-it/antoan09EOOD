'use client';
import { useState } from 'react';
import Link from 'next/link';

interface Fields {
  brand: string | null;
  model: string | null;
  serial: string | null;
  year: number | null;
  type: string | null;
  capacityKg: number | null;
  agent: string | null;
}
interface Match {
  id: string;
  siteId: string;
  siteName: string;
  ownerName: string;
  ownerAddress: string;
  ownerPhone: string;
  category: string | null;
  mass: number | null;
}
interface Resp {
  ok: boolean;
  demo?: boolean;
  fields?: Fields;
  match?: Match | null;
  status?: { level: string; label: string; dueAction?: 'TO' | 'recharge' | 'HI' | null } | null;
  error?: string;
}

const AGENT_LABEL: Record<string, string> = {
  powder_abc: 'Прах', powder_bc: 'Прах', water: 'Вода', foam: 'Пяна', co2: 'CO2',
};
const KIND_LABEL: Record<string, string> = { TO: 'ТО', recharge: 'П', HI: 'ХИ' };
const KIND_OPTS = [
  { v: 'TO', l: 'ТО — техническо обслужване' },
  { v: 'recharge', l: 'П — презареждане / смяна' },
  { v: 'HI', l: 'ХИ — хидростатично изпитване' },
];
function chipClass(level?: string): string {
  return level === 'overdue' ? 'over' : level ?? '';
}
function bg(iso: string): string {
  return iso.split('-').reverse().join('.');
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function StickerScan() {
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<Resp | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // редактируеми полета на протокола
  const [action, setAction] = useState('TO');
  const [date, setDate] = useState(today());
  const [tech, setTech] = useState('');
  const [sticker, setSticker] = useState('');
  const [agentTrade, setAgentTrade] = useState('');
  const [notes, setNotes] = useState('');
  const [gen, setGen] = useState(false);
  const [mail, setMail] = useState<string | null>(null);

  const needsAgent = action === 'recharge';

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResp(null);
    setMail(null);
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
        const j: Resp = await r.json();
        setResp(j);
        if (j.status?.dueAction) setAction(j.status.dueAction);
        if (j.fields?.agent) setAgentTrade(j.fields.agent);
      } catch {
        setResp({ ok: false, error: 'Грешка при заявката' });
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  }

  function buildProtocol() {
    const f = resp!.fields!;
    const m = resp!.match!;
    const massNum = m.mass ?? f.capacityKg ?? 0;
    const line = {
      idx: 1,
      markings: `${f.model ?? ''} № ${f.serial ?? ''} / ${f.year ?? ''}`.trim(),
      category: m.category ?? '',
      mass: massNum ? massNum.toFixed(3).replace('.', ',') : '',
      agent: f.type ? AGENT_LABEL[f.type] ?? '' : '',
      agentTradeName: needsAgent ? agentTrade : '',
      serviceKind: KIND_LABEL[action] ?? action,
      serviceDate: bg(date),
      technicianName: tech,
      stickerNo: sticker,
      notes,
    };
    return {
      protocolNo: '',
      date: bg(date),
      city: 'Нова Загора',
      ownerName: m.ownerName,
      ownerAddress: m.ownerAddress,
      ownerPhone: m.ownerPhone,
      lines: [line],
    };
  }

  async function generateWord() {
    setGen(true);
    setMail(null);
    try {
      const r = await fetch('/api/protocols/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildProtocol()),
      });
      if (!r.ok) {
        setMail('✗ Грешка при генериране');
        return;
      }
      const blob = await r.blob();
      const cd = r.headers.get('Content-Disposition') ?? '';
      const name = /filename="(.+?)"/.exec(cd)?.[1] ?? 'protokol.docx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGen(false);
    }
  }

  async function sendEmail() {
    setGen(true);
    setMail(null);
    try {
      const r = await fetch('/api/protocols/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocol: buildProtocol() }),
      });
      const j = await r.json();
      if (j.ok) setMail(`✓ Изпратено по имейл (протокол № ${j.protocolNo})`);
      else setMail(`✗ ${j.error ?? 'Имейлът не е изпратен'}`);
    } catch {
      setMail('✗ Мрежова грешка');
    } finally {
      setGen(false);
    }
  }

  const f = resp?.fields;
  const m = resp?.match ?? null;

  return (
    <div className="scan-box" style={{ marginTop: 22, maxWidth: 560 }}>
      <div className="sec-h"><h2>AI разпознаване по снимка</h2></div>
      <p className="hint">Качи или снимай стикера — системата разпознава гасителя и подготвя протокола.</p>
      <input type="file" accept="image/*" capture="environment" onChange={onFile} disabled={busy} style={{ marginTop: 10 }} />
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="стикер" style={{ maxWidth: 180, marginTop: 12, borderRadius: 10, display: 'block' }} />
      )}
      {busy && <p className="hint" style={{ marginTop: 10 }}>Разпознаване…</p>}

      {resp?.ok && f && (
        <div style={{ marginTop: 16 }}>
          {resp.demo && (
            <p className="hint" style={{ color: 'var(--soon)' }}>⚠ демо разпознаване (Hermes още не е вързан)</p>
          )}
          <p style={{ fontWeight: 700, fontSize: 17, marginTop: 6 }}>
            {f.model ?? f.brand ?? 'Пожарогасител'} № {f.serial ?? '—'} / {f.year ?? '—'}
            {resp.status && <span className={`chip ${chipClass(resp.status.level)}`} style={{ marginLeft: 10 }}>{resp.status.label}</span>}
          </p>

          {m ? (
            <div style={{ border: '1px solid var(--line2)', borderRadius: 14, padding: 16, marginTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Преглед на протокола</div>
              <p className="hint" style={{ marginBottom: 12 }}>
                Клиент: <b>{m.ownerName}</b> · Обект: {m.siteName} · {f.type ? AGENT_LABEL[f.type] : ''}
                {m.mass != null ? ` · ${String(m.mass).replace('.', ',')} кг` : ''}
                {m.category ? ` · кат. ${m.category}` : ''}
              </p>

              <div style={{ display: 'grid', gap: 10 }}>
                <label className="hint">Вид дейност
                  <select value={action} onChange={(e) => setAction(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                    {KIND_OPTS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
                  </select>
                </label>
                <label className="hint">Дата
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
                </label>
                <label className="hint">Техник
                  <input value={tech} onChange={(e) => setTech(e.target.value)} placeholder="напр. Х. Христов" style={{ width: '100%', marginTop: 4 }} />
                </label>
                <label className="hint">Стикер №
                  <input value={sticker} onChange={(e) => setSticker(e.target.value)} placeholder="напр. 0615" style={{ width: '100%', marginTop: 4 }} />
                </label>
                {needsAgent && (
                  <label className="hint">Гасително вещество
                    <input value={agentTrade} onChange={(e) => setAgentTrade(e.target.value)} placeholder="напр. Кобра ABC 50" style={{ width: '100%', marginTop: 4 }} />
                  </label>
                )}
                <label className="hint">Забележки
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="по избор" style={{ width: '100%', marginTop: 4 }} />
                </label>
              </div>

              <div className="btn-row" style={{ marginTop: 16 }}>
                <button className="btn btn-fire" disabled={gen} onClick={generateWord}>📄 Генерирай Word</button>
                <button className="btn" style={{ border: '1px solid var(--line2)', color: 'inherit' }} disabled={gen} onClick={sendEmail}>✉ Изпрати на имейл</button>
                <Link className="btn" href={`/pg/${m.id}`} style={{ border: '1px solid var(--line2)', color: 'inherit' }}>Виж картата</Link>
              </div>
              {mail && <p className="hint" style={{ marginTop: 10, color: mail.startsWith('✓') ? 'var(--ok)' : 'var(--over)' }}>{mail}</p>}
            </div>
          ) : (
            <p className="hint" style={{ marginTop: 10 }}>Няма съвпадение по сериен № в базата. Добави гасителя ръчно от обекта.</p>
          )}
        </div>
      )}
      {resp && !resp.ok && <p className="hint" style={{ color: 'var(--over)', marginTop: 10 }}>{resp.error}</p>}

      <p className="hint" style={{ marginTop: 18 }}>
        или <Link href="/" style={{ color: 'var(--soon)' }}>избери ръчно от обектите →</Link>
      </p>
    </div>
  );
}
