'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { deriveCategory } from '@/lib/regulatory/category';
import type { ExtinguisherType } from '@/lib/regulatory/types';

interface Fields {
  brand: string | null; model: string | null; serial: string | null; year: number | null;
  type: string | null; capacityKg: number | null; agent: string | null;
}
interface Match {
  id: string; siteId: string; siteName: string; ownerName: string; ownerAddress: string; ownerPhone: string;
  category: string | null; mass: number | null; brand: string | null; model: string | null;
  type: string | null; serial: string | null; year: number | null;
}
interface Resp {
  ok: boolean; demo?: boolean; confidence?: number; fields?: Fields; match?: Match | null;
  status?: { level: string; label: string; dueAction?: 'TO' | 'recharge' | 'HI' | null } | null;
  raw?: string | null;
  error?: string;
}
interface Site { id: string; siteName: string; ownerName: string; ownerAddress: string; ownerPhone: string }

// Минимални типове за Web Speech API (за гласов вход без външни зависимости).
type SpeechRec = {
  lang: string; interimResults: boolean; maxAlternatives: number;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void; onerror: () => void; start: () => void; stop: () => void;
};
type SpeechWin = Window & {
  SpeechRecognition?: new () => SpeechRec;
  webkitSpeechRecognition?: new () => SpeechRec;
};

const AGENT_LABEL: Record<string, string> = { powder_abc: 'Прах', powder_bc: 'Прах', water: 'Вода', foam: 'Пяна', co2: 'CO2' };
const KIND_LABEL: Record<string, string> = { TO: 'ТО', recharge: 'П', HI: 'ХИ' };
const KIND_OPTS = [
  { v: 'TO', l: 'ТО — техническо обслужване' },
  { v: 'recharge', l: 'П — презареждане / смяна' },
  { v: 'HI', l: 'ХИ — хидростатично изпитване' },
];
const TYPE_OPTS = [
  { v: 'powder_abc', l: 'Прахов ABC' }, { v: 'powder_bc', l: 'Прахов BC' },
  { v: 'water', l: 'Воден' }, { v: 'foam', l: 'Водопенен' }, { v: 'co2', l: 'CO₂' },
];
const CAP_OPTS = ['1', '2', '3', '4', '5', '6', '9', '12', '25', '50'];
const CAT_OPTS = ['К1', 'К2', 'К3', 'К4', 'К5'];
const BRANDS = ['Спарк', 'Солти', 'Огнехром', 'Торнадо', 'Дрипалдер', 'Ятрус', 'Sparky', 'Gloria', 'Bavaria', 'Total', 'Minimax', 'Ceasefire', 'Tyco', 'Sicli', 'Chubb', 'FirePro', 'Ansul', 'Kidde', 'Amerex', 'Pastor'];

const chipClass = (l?: string) => (l === 'overdue' ? 'over' : l ?? '');
const bg = (iso: string) => iso.split('-').reverse().join('.');
const today = () => new Date().toISOString().slice(0, 10);
const fieldStyle: React.CSSProperties = { width: '100%', marginTop: 4, fontSize: 16 };

// Смалява снимката до ~1600px JPEG преди качване (по-бързо + избягва timeouts на голями файлове).
async function loadImageDataUrl(file: File): Promise<string> {
  try {
    return await new Promise<string>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxDim = 1600;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        if (!ctx) { reject(new Error('no ctx')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')); };
      img.src = url;
    });
  } catch {
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error('read'));
      r.readAsDataURL(file);
    });
  }
}

export default function StickerScan() {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<Resp | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [pickedSite, setPickedSite] = useState('');
  const [added, setAdded] = useState<string | null>(null);

  // Гасител (графи на протокола) — всичко редактируемо, AI пред-попълва.
  const [eBrand, setEBrand] = useState('');
  const [eModel, setEModel] = useState('');
  const [eSerial, setESerial] = useState('');
  const [eYear, setEYear] = useState('');
  const [eType, setEType] = useState('powder_abc');
  const [eCap, setECap] = useState('');
  const [eCategory, setECategory] = useState('К2');     // графа 3
  const [eTotalMass, setETotalMass] = useState('');     // графа 4 — обща (бруто) маса
  const [action, setAction] = useState('TO');
  const [date, setDate] = useState(today());
  const [tech, setTech] = useState('');
  const [sticker, setSticker] = useState('');
  const [agentTrade, setAgentTrade] = useState('');
  const [notes, setNotes] = useState('');
  // Собственик / получател — редактируем (заглавна част)
  const [oName, setOName] = useState('');
  const [oAddr, setOAddr] = useState('');
  const [oPhone, setOPhone] = useState('');
  const [oSiteId, setOSiteId] = useState<string | undefined>(undefined);
  const [gen, setGen] = useState(false);
  const [mail, setMail] = useState<string | null>(null);

  // Гласов вход за бележките (Web Speech API, безплатно, на български).
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  useEffect(() => {
    const w = window as unknown as SpeechWin;
    setVoiceSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);
  function toggleVoice() {
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const w = window as unknown as SpeechWin;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'bg-BG'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      const t = ev.results?.[0]?.[0]?.transcript ?? '';
      if (t) setNotes((p) => (p ? `${p} ${t}` : t));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  }

  const needsAgent = action === 'recharge';

  useEffect(() => {
    fetch('/api/sites').then((r) => r.json()).then((j) => setSites(j.sites ?? [])).catch(() => {});
  }, []);

  function applyType(t: string) {
    setEType(t);
    setECategory(deriveCategory(t as ExtinguisherType)); // авто-категория по типа (редактируема след това)
  }
  function pickSite(id: string) {
    setPickedSite(id);
    const s = sites.find((x) => x.id === id);
    setOSiteId(id || undefined);
    if (s) { setOName(s.ownerName); setOAddr(s.ownerAddress); setOPhone(s.ownerPhone); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResp(null); setMail(null); setAdded(null); setPickedSite('');
    setBusy(true);
    try {
      const dataUrl = await loadImageDataUrl(file);
      setPreview(dataUrl);
      const base64 = dataUrl.split(',')[1] ?? '';
      const r = await fetch('/api/vision/sticker', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      const j: Resp = await r.json();
      setResp(j);
      const mm = j.match; const ff = j.fields;
      setEBrand((mm?.brand ?? ff?.brand) ?? '');
      setEModel((mm?.model ?? ff?.model) ?? '');
      setESerial((mm?.serial ?? ff?.serial) ?? '');
      setEYear(String(mm?.year ?? ff?.year ?? ''));
      const t = String(mm?.type ?? ff?.type ?? 'powder_abc');
      setEType(t);
      setECategory(mm?.category || deriveCategory(t as ExtinguisherType));
      setECap(String(mm?.mass ?? ff?.capacityKg ?? ''));
      setETotalMass('');
      if (j.status?.dueAction) setAction(j.status.dueAction);
      if (ff?.agent) setAgentTrade(ff.agent);
      // Собственик — от съвпадението (ако има), иначе празно за ръчно/избор
      setOSiteId(mm?.siteId);
      setOName(mm?.ownerName ?? '');
      setOAddr(mm?.ownerAddress ?? '');
      setOPhone(mm?.ownerPhone ?? '');
    } catch {
      setResp({ ok: false, error: 'Грешка при заявката' });
    } finally {
      setBusy(false);
    }
  }

  const matched = resp?.match ?? null;
  const f = resp?.fields;
  const lowConfidence = typeof resp?.confidence === 'number' && resp.confidence > 0 && resp.confidence < 0.5;
  const canGenerate = !!oName.trim(); // достатъчно е да има собственик (обектът е по избор)

  function buildProtocol() {
    const massNum = Number((eTotalMass || '0').replace(',', '.'));
    const typeLabel = TYPE_OPTS.find((t) => t.v === eType)?.l ?? '';
    const modelTxt = eModel || `${eBrand ? eBrand + ' ' : ''}${typeLabel} ${eCap} кг`.trim();
    return {
      protocolNo: '', date: bg(date), city: 'Нова Загора', siteId: oSiteId,
      ownerName: oName, ownerAddress: oAddr, ownerPhone: oPhone,
      lines: [{
        idx: 1,
        markings: `${modelTxt} № ${eSerial} / ${eYear}`.trim(),
        category: eCategory,
        mass: massNum ? massNum.toFixed(3).replace('.', ',') : '',
        agent: AGENT_LABEL[eType] ?? '',
        agentTradeName: needsAgent ? agentTrade : '',
        serviceKind: KIND_LABEL[action] ?? action,
        serviceDate: bg(date), technicianName: tech, stickerNo: sticker, notes,
      }],
    };
  }

  async function generateWord() {
    if (!canGenerate) { setMail('Попълни поне собственик (или избери обект).'); return; }
    setGen(true); setMail(null);
    try {
      const r = await fetch('/api/protocols/custom', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildProtocol()),
      });
      if (!r.ok) { setMail('✗ Грешка при генериране'); return; }
      const blob = await r.blob();
      const cd = r.headers.get('Content-Disposition') ?? '';
      const name = /filename="(.+?)"/.exec(cd)?.[1] ?? 'protokol.docx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    } finally { setGen(false); }
  }

  async function sendEmail() {
    if (!canGenerate) { setMail('Попълни поне собственик (или избери обект).'); return; }
    setGen(true); setMail(null);
    try {
      const r = await fetch('/api/protocols/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ protocol: buildProtocol() }),
      });
      const j = await r.json();
      setMail(j.ok ? `✓ Изпратено по имейл (протокол № ${j.protocolNo})` : `✗ ${j.error ?? 'Имейлът не е изпратен'}`);
    } catch { setMail('✗ Мрежова грешка'); } finally { setGen(false); }
  }

  async function addToDb() {
    if (!pickedSite || !eSerial) { setAdded('Избери обект и въведи сериен №.'); return; }
    setGen(true); setAdded(null);
    try {
      const r = await fetch('/api/extinguishers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: pickedSite, type: eType, model: eModel, serialNumber: eSerial,
          manufactureYear: Number(eYear), massKg: eCap ? Number(eCap.replace(',', '.')) : undefined,
          grossMassKg: eTotalMass ? Number(eTotalMass.replace(',', '.')) : undefined, category: eCategory || undefined,
        }),
      });
      const j = await r.json();
      setAdded(j.ok ? '✓ Добавен в базата (вече ще се разпознава по сериен №)' : `✗ ${j.error ?? 'Грешка'}`);
    } catch { setAdded('✗ Мрежова грешка'); } finally { setGen(false); }
  }

  const btnBig: React.CSSProperties = { fontSize: 16, padding: '16px 22px', flex: '1 1 200px' };
  const capOptions = CAP_OPTS.includes(eCap) || !eCap ? CAP_OPTS : [eCap, ...CAP_OPTS];

  return (
    <div className="scan-box" style={{ marginTop: 8, maxWidth: 600 }}>
      <div className="sec-h"><h2>📸 Сканирай стикер (AI)</h2></div>
      <p className="hint" style={{ marginBottom: 8 }}>Снимай или качи стикера — после потвърждаваш/коригираш от менютата.</p>
      <p className="hint" style={{ marginBottom: 14, color: 'var(--soon)' }}>💡 Снимай <b>отблизо самия етикет/стикер</b> (не целия гасител) — така AI разчита марка, сериен № и дати.</p>

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
        <div style={{ border: '1px solid var(--line2)', borderRadius: 14, padding: 16, marginTop: 16 }}>
          <div style={{ fontWeight: 700 }}>
            {matched ? '✓ Разпознат и намерен' : 'Разпознат гасител'}
            {resp.status && <span className={`chip ${chipClass(resp.status.level)}`} style={{ marginLeft: 10 }}>{resp.status.label}</span>}
          </div>

          {matched ? (
            <p className="hint" style={{ marginTop: 6 }}>✓ Намерен в базата · Клиент: <b>{matched.ownerName}</b> · Обект: {matched.siteName}</p>
          ) : (
            <div style={{ marginTop: 10 }}>
              <p className="hint" style={{ color: 'var(--soon)' }}>👇 Избери обект (или попълни собственика ръчно по-долу):</p>
              <select value={pickedSite} onChange={(e) => pickSite(e.target.value)} style={fieldStyle}>
                <option value="">— избери обект —</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.siteName} · {s.ownerName}</option>)}
              </select>
            </div>
          )}

          {lowConfidence && (
            <p className="hint" style={{ marginTop: 8, color: 'var(--soon)' }}>ℹ Снимката беше малко неясна — разпознах приблизително. Само провери полетата по-долу.</p>
          )}

          {resp.raw && (
            <details style={{ marginTop: 10 }}>
              <summary className="hint" style={{ cursor: 'pointer' }}>📄 Прочетен текст от снимката (OCR)</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, color: 'var(--muted)', marginTop: 6, padding: 8, background: 'var(--panel2)', borderRadius: 8 }}>{resp.raw}</pre>
            </details>
          )}

          <p className="hint" style={{ margin: '14px 0 0', color: 'var(--soon)' }}>✎ Провери и коригирай всичко (всяка графа е редактируема):</p>
          <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
            <label className="hint">Марка
              <input list="brand-list" value={eBrand} onChange={(e) => setEBrand(e.target.value)} style={fieldStyle} placeholder="избери или въведи" />
              <datalist id="brand-list">{BRANDS.map((b) => <option key={b} value={b} />)}</datalist>
            </label>
            <label className="hint">Модел<input value={eModel} onChange={(e) => setEModel(e.target.value)} style={fieldStyle} placeholder="напр. Спарк 6 кг" /></label>
            <div style={{ display: 'flex', gap: 10 }}>
              <label className="hint" style={{ flex: 1, minWidth: 0 }}>Тип
                <select value={eType} onChange={(e) => applyType(e.target.value)} style={fieldStyle}>{TYPE_OPTS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
              </label>
              <label className="hint" style={{ flex: 1, minWidth: 0 }}>Капацитет (кг/л)
                <select value={eCap} onChange={(e) => setECap(e.target.value)} style={fieldStyle}><option value="">—</option>{capOptions.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <label className="hint" style={{ flex: 1, minWidth: 0 }}>Категория
                <select value={eCategory} onChange={(e) => setECategory(e.target.value)} style={fieldStyle}>{CAT_OPTS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              </label>
              <label className="hint" style={{ flex: 1, minWidth: 0 }}>Обща маса (кг)
                <input value={eTotalMass} onChange={(e) => setETotalMass(e.target.value)} style={fieldStyle} inputMode="decimal" placeholder="напр. 1,600" />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <label className="hint" style={{ flex: 1, minWidth: 0 }}>Сериен № (на корпуса)<input value={eSerial} onChange={(e) => setESerial(e.target.value)} style={fieldStyle} /></label>
              <label className="hint" style={{ flex: 1, minWidth: 0 }}>Година<input type="number" value={eYear} onChange={(e) => setEYear(e.target.value)} style={fieldStyle} /></label>
            </div>
            <label className="hint">Вид дейност
              <select value={action} onChange={(e) => setAction(e.target.value)} style={fieldStyle}>{KIND_OPTS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}</select>
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <label className="hint" style={{ flex: 1, minWidth: 0 }}>Дата<input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle} /></label>
              <label className="hint" style={{ flex: 1, minWidth: 0 }}>Стикер №<input value={sticker} onChange={(e) => setSticker(e.target.value)} style={fieldStyle} placeholder="номер на стикера" /></label>
            </div>
            <label className="hint">Техник (извършил обслужването)<input value={tech} onChange={(e) => setTech(e.target.value)} style={fieldStyle} placeholder="напр. Х. Христов" /></label>
            {needsAgent && <label className="hint">Търговско наименование (продукт за презареждане)<input value={agentTrade} onChange={(e) => setAgentTrade(e.target.value)} style={fieldStyle} placeholder="напр. Кобра ABC 50 / пенообразувател" /></label>}

            <p className="hint" style={{ margin: '6px 0 0', color: 'var(--soon)' }}>На кого се предава (собственик):</p>
            <label className="hint">Собственик / клиент<input value={oName} onChange={(e) => setOName(e.target.value)} style={fieldStyle} placeholder="напр. ЕТ Иванов" /></label>
            <div style={{ display: 'flex', gap: 10 }}>
              <label className="hint" style={{ flex: 2, minWidth: 0 }}>Адрес<input value={oAddr} onChange={(e) => setOAddr(e.target.value)} style={fieldStyle} /></label>
              <label className="hint" style={{ flex: 1, minWidth: 0 }}>Телефон<input value={oPhone} onChange={(e) => setOPhone(e.target.value)} style={fieldStyle} inputMode="tel" /></label>
            </div>

            <label className="hint">Забележки{voiceSupported && ' (може и гласово)'}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 4 }}>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...fieldStyle, marginTop: 0, flex: 1, resize: 'vertical' }} placeholder="по избор — напиши или продиктувай" />
                {voiceSupported && (
                  <button
                    type="button"
                    onClick={toggleVoice}
                    title={listening ? 'Спри диктовката' : 'Диктувай бележка'}
                    className="btn"
                    style={{ padding: '10px 13px', border: '1px solid var(--line2)', color: 'inherit', background: listening ? 'var(--over)' : undefined }}
                  >
                    {listening ? '⏹' : '🎤'}
                  </button>
                )}
              </div>
              {listening && <span className="hint" style={{ color: 'var(--soon)' }}>🎙️ Слушам… говори на български.</span>}
            </label>
          </div>

          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn btn-fire" style={btnBig} disabled={gen || !canGenerate} onClick={generateWord}>📄 Генерирай Word</button>
            <button className="btn" style={{ ...btnBig, border: '1px solid var(--line2)', color: 'inherit' }} disabled={gen || !canGenerate} onClick={sendEmail}>✉ Изпрати на имейл</button>
          </div>
          {!matched && (
            <div style={{ marginTop: 10 }}>
              <button className="btn" style={{ border: '1px solid var(--line2)', color: 'inherit' }} disabled={gen || !pickedSite} onClick={addToDb}>➕ Добави гасителя в базата</button>
              {added && <p className="hint" style={{ marginTop: 8, color: added.startsWith('✓') ? 'var(--ok)' : 'var(--over)' }}>{added}</p>}
            </div>
          )}
          {matched && (
            <div style={{ marginTop: 10 }}>
              <Link className="btn" href={`/pg/${matched.id}`} style={{ border: '1px solid var(--line2)', color: 'inherit' }}>Виж картата</Link>
            </div>
          )}
          {mail && <p className="hint" style={{ marginTop: 10, color: mail.startsWith('✓') ? 'var(--ok)' : 'var(--over)' }}>{mail}</p>}
        </div>
      )}
      {resp && !resp.ok && <p className="hint" style={{ color: 'var(--over)', marginTop: 10 }}>{resp.error}</p>}

      <p className="hint" style={{ marginTop: 18 }}>или <Link href="/" style={{ color: 'var(--soon)' }}>избери ръчно от обектите →</Link></p>
    </div>
  );
}
