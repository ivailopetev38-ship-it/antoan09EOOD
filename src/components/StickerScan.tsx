'use client';
import { useState, useRef } from 'react';
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
  brand: string | null;
  model: string | null;
  type: string | null;
  serial: string | null;
  year: number | null;
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
const TYPE_OPTS = [
  { v: 'powder_abc', l: 'Прахов ABC' },
  { v: 'powder_bc', l: 'Прахов BC' },
  { v: 'water', l: 'Воден' },
  { v: 'foam', l: 'Водопенен' },
  { v: 'co2', l: 'CO₂' },
];
const CAP_OPTS = ['1', '2', '3', '4', '5', '6', '9', '12', '25', '50'];
const BRANDS = [
  'Солти', 'Огнехром', 'Торнадо', 'Дрипалдер', 'Ятрус', 'Sparky', 'Gloria', 'Bavaria', 'Total',
  'Ceasefire', 'Minimax', 'Tyco', 'Sicli', 'Chubb', 'FirePro', 'Ansul', 'Kidde', 'Amerex', 'Pastor',
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
const fieldStyle: React.CSSProperties = { width: '100%', marginTop: 4, padding: 9, fontSize: 15 };

export default function StickerScan() {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<Resp | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // редактируеми разпознати полета (с предложения)
  const [eBrand, setEBrand] = useState('');
  const [eModel, setEModel] = useState('');
  const [eSerial, setESerial] = useState('');
  const [eYear, setEYear] = useState('');
  const [eType, setEType] = useState('powder_abc');
  const [eCap, setECap] = useState('');
  // протоколни полета
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
        const mm = j.match;
        const ff = j.fields;
        // при познат гасител → ползваме верните данни от базата; иначе разпознатите
        setEBrand((mm?.brand ?? ff?.brand) ?? '');
        setEModel((mm?.model ?? ff?.model) ?? '');
        setESerial((mm?.serial ?? ff?.serial) ?? '');
        setEYear(String(mm?.year ?? ff?.year ?? ''));
        setEType(String(mm?.type ?? ff?.type ?? 'powder_abc'));
        setECap(String(mm?.mass ?? ff?.capacityKg ?? ''));
        if (j.status?.dueAction) setAction(j.status.dueAction);
        if (ff?.agent) setAgentTrade(ff.agent);
      } catch {
        setResp({ ok: false, error: 'Грешка при заявката' });
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  }

  function buildProtocol() {
    const m = resp!.match!;
    const capNum = Number((eCap || '0').replace(',', '.'));
    const typeLabel = TYPE_OPTS.find((t) => t.v === eType)?.l ?? '';
    const modelTxt = eModel || `${eBrand ? eBrand + ' ' : ''}${typeLabel} ${eCap} кг`.trim();
    const line = {
      idx: 1,
      markings: `${modelTxt} № ${eSerial} / ${eYear}`.trim(),
      category: m.category ?? '',
      mass: capNum ? capNum.toFixed(3).replace('.', ',') : '',
      agent: AGENT_LABEL[eType] ?? '',
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
  const btnBig: React.CSSProperties = { fontSize: 16, padding: '16px 22px', flex: '1 1 200px' };
  const capOptions = CAP_OPTS.includes(eCap) || !eCap ? CAP_OPTS : [eCap, ...CAP_OPTS];

  return (
    <div className="scan-box" style={{ marginTop: 8, maxWidth: 600 }}>
      <div className="sec-h"><h2>📸 Сканирай стикер (AI)</h2></div>
      <p className="hint" style={{ marginBottom: 14 }}>
        Снимай или качи стикера — системата го разпознава, а ти потвърждаваш/коригираш от предложенията.
      </p>

      <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: 'none' }} />
      <input ref={galRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />

      <div className="btn-row" style={{ marginTop: 0 }}>
        <button className="btn btn-fire" style={btnBig} disabled={busy} onClick={() => camRef.current?.click()}>📷 Снимай стикер</button>
        <button className="btn" style={{ ...btnBig, border: '1px solid var(--line2)', color: 'inherit' }} disabled={busy} onClick={() => galRef.current?.click()}>🖼️ Качи снимка</button>
      </div>

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="стикер" style={{ maxWidth: 160, marginTop: 14, borderRadius: 10, display: 'block' }} />
      )}
      {busy && <p className="hint" style={{ marginTop: 12, fontSize: 15 }}>🔎 Разпознаване…</p>}

      {resp?.ok && f && (
        <div style={{ marginTop: 16 }}>
          {resp.demo && <p className="hint" style={{ color: 'var(--soon)' }}>⚠ демо разпознаване</p>}
          <p style={{ fontWeight: 700, fontSize: 16, marginTop: 6 }}>
            Разпознат гасител
            {resp.status && <span className={`chip ${chipClass(resp.status.level)}`} style={{ marginLeft: 10 }}>{resp.status.label}</span>}
          </p>

          {m ? (
            <div style={{ border: '1px solid var(--line2)', borderRadius: 14, padding: 16, marginTop: 10 }}>
              <p className="hint" style={{ marginBottom: 10 }}>
                Клиент: <b>{m.ownerName}</b> · Обект: {m.siteName}
              </p>
              <p className="hint" style={{ marginBottom: 12, color: 'var(--soon)' }}>
                ✎ Провери и коригирай от менютата, ако нещо е разчетено грешно:
              </p>

              <div style={{ display: 'grid', gap: 10 }}>
                <label className="hint">Марка
                  <input list="brand-list" value={eBrand} onChange={(e) => setEBrand(e.target.value)} style={fieldStyle} placeholder="избери или въведи" />
                  <datalist id="brand-list">{BRANDS.map((b) => <option key={b} value={b} />)}</datalist>
                </label>
                <label className="hint">Модел
                  <input value={eModel} onChange={(e) => setEModel(e.target.value)} style={fieldStyle} placeholder="напр. Спарк 6 кг" />
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <label className="hint" style={{ flex: 1 }}>Тип
                    <select value={eType} onChange={(e) => setEType(e.target.value)} style={fieldStyle}>
                      {TYPE_OPTS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                    </select>
                  </label>
                  <label className="hint" style={{ flex: 1 }}>Капацитет (кг/л)
                    <select value={eCap} onChange={(e) => setECap(e.target.value)} style={fieldStyle}>
                      <option value="">—</option>
                      {capOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <label className="hint" style={{ flex: 1 }}>Сериен №
                    <input value={eSerial} onChange={(e) => setESerial(e.target.value)} style={fieldStyle} />
                  </label>
                  <label className="hint" style={{ flex: 1 }}>Година
                    <input type="number" value={eYear} onChange={(e) => setEYear(e.target.value)} style={fieldStyle} />
                  </label>
                </div>
                <label className="hint">Вид дейност
                  <select value={action} onChange={(e) => setAction(e.target.value)} style={fieldStyle}>
                    {KIND_OPTS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
                  </select>
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <label className="hint" style={{ flex: 1 }}>Дата
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
                  </label>
                  <label className="hint" style={{ flex: 1 }}>Стикер №
                    <input value={sticker} onChange={(e) => setSticker(e.target.value)} style={fieldStyle} placeholder="напр. 0615" />
                  </label>
                </div>
                <label className="hint">Техник
                  <input value={tech} onChange={(e) => setTech(e.target.value)} style={fieldStyle} placeholder="напр. Х. Христов" />
                </label>
                {needsAgent && (
                  <label className="hint">Гасително вещество
                    <input value={agentTrade} onChange={(e) => setAgentTrade(e.target.value)} style={fieldStyle} placeholder="напр. Кобра ABC 50" />
                  </label>
                )}
                <label className="hint">Забележки
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} style={fieldStyle} placeholder="по избор" />
                </label>
              </div>

              <div className="btn-row" style={{ marginTop: 16 }}>
                <button className="btn btn-fire" style={btnBig} disabled={gen} onClick={generateWord}>📄 Генерирай Word</button>
                <button className="btn" style={{ ...btnBig, border: '1px solid var(--line2)', color: 'inherit' }} disabled={gen} onClick={sendEmail}>✉ Изпрати на имейл</button>
              </div>
              <div style={{ marginTop: 10 }}>
                <Link className="btn" href={`/pg/${m.id}`} style={{ border: '1px solid var(--line2)', color: 'inherit' }}>Виж картата</Link>
              </div>
              {mail && <p className="hint" style={{ marginTop: 10, color: mail.startsWith('✓') ? 'var(--ok)' : 'var(--over)' }}>{mail}</p>}
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <p>{eModel || eBrand || 'Пожарогасител'} № {eSerial || '—'} / {eYear || '—'} · {TYPE_OPTS.find((t) => t.v === eType)?.l} · {eCap || '—'} кг</p>
              <p className="hint" style={{ marginTop: 8 }}>Този сериен № не е в базата. Добави гасителя от обекта, после генерирай протокол.</p>
            </div>
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
