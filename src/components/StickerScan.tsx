'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { deriveCategory } from '@/lib/regulatory/category';
import type { ExtinguisherType } from '@/lib/regulatory/types';
import { draftToLine, emptyDraft, small1kgDefaults, stdMass, type LineDraft } from '@/lib/protocol/draft';
import type { ProtocolData } from '@/lib/protocol/types';

interface Site { id: string; siteName: string; ownerName: string; ownerAddress: string; ownerPhone: string; ownerEmail: string }

const TYPE_OPTS = [
  { v: 'powder_abc', l: 'Прахов ABC' }, { v: 'powder_bc', l: 'Прахов BC' },
  { v: 'water', l: 'Воден' }, { v: 'foam', l: 'Водопенен' }, { v: 'co2', l: 'CO₂' },
];
const CAP_OPTS = ['1', '2', '3', '4', '5', '6', '9', '12', '25', '50'];
const CAT_OPTS = ['К1', 'К2', 'К5']; // К1 водопенни/водни · К2 прахови · К5 въглеродни (CO₂)
// Графа 7: ТО винаги присъства; по избор + ХИ и/или ПЗ (ред ТО → ХИ → ПЗ).
const KIND_OPTS = [
  { v: 'TO', l: 'само ТО (техническо обслужване)' },
  { v: 'TO_HI', l: 'ТО + ХИ (хидростатично)' },
  { v: 'TO_PZ', l: 'ТО + ПЗ (презареждане)' },
  { v: 'TO_HI_PZ', l: 'ТО + ХИ + ПЗ' },
];
const BRANDS = ['Спарк', 'Солти', 'Огнехром', 'Торнадо', 'Дрипалдер', 'Ятрус', 'Sparky', 'Gloria', 'Bavaria', 'Total', 'Minimax', 'Ceasefire', 'Tyco', 'Sicli', 'Chubb', 'FirePro', 'Ansul', 'Kidde', 'Amerex', 'Pastor'];

const bg = (iso: string) => iso.split('-').reverse().join('.');
const today = () => new Date().toISOString().slice(0, 10);
const fieldStyle: React.CSSProperties = { width: '100%', marginTop: 4, fontSize: 16 };

// Малък бадж: коя графа от Приложение № 9 попълва полето.
function Gr({ n, title }: { n: number; title: string }) {
  return (
    <span title={`Графа ${n}: ${title}`} style={{ fontSize: 11, fontWeight: 700, color: 'var(--soon)', border: '1px solid var(--line2)', borderRadius: 6, padding: '0 6px', marginLeft: 6, whiteSpace: 'nowrap' }}>
      графа {n}
    </span>
  );
}

// Смалява снимката до ~1600px JPEG преди качване (по-бързо + избягва timeouts).
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

// Редактируеми полета за един ред (гасител). Преизползва се за кошницата и за добавянето.
function LineFields({ d, on }: { d: LineDraft; on: (p: Partial<LineDraft>) => void }) {
  const capOptions = CAP_OPTS.includes(d.cap) || !d.cap ? CAP_OPTS : [d.cap, ...CAP_OPTS];
  const needsAgent = d.action !== 'TO'; // графа 6 при ПЗ или ХИ
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <label className="hint">Марка<Gr n={2} title="Ид. маркировка (марка, модел, сериен №, година)" />
        <input list="brand-list" value={d.brand} onChange={(e) => on({ brand: e.target.value })} style={fieldStyle} placeholder="избери или въведи" />
      </label>
      <label className="hint">Модел<Gr n={2} title="Ид. маркировка" /><input value={d.model} onChange={(e) => on({ model: e.target.value })} style={fieldStyle} placeholder="напр. Спарк 6 кг" /></label>
      <div className="frow">
        <label className="hint" style={{ flex: 1, minWidth: 0 }}>Тип<Gr n={5} title="Пожарогасително вещество (вода, прах, CO₂)" />
          <select value={d.type} onChange={(e) => { const tp = e.target.value; on({ type: tp, category: deriveCategory(tp as ExtinguisherType), totalMass: stdMass(tp, d.cap) || d.totalMass }); }} style={fieldStyle}>{TYPE_OPTS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
        </label>
        <label className="hint" style={{ flex: 1, minWidth: 0 }}>Капацитет (кг/л)<Gr n={2} title="Влиза в маркировката" />
          <select value={d.cap} onChange={(e) => { const cp = e.target.value; on({ cap: cp, totalMass: stdMass(d.type, cp) || d.totalMass }); }} style={fieldStyle}><option value="">—</option>{capOptions.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </label>
      </div>
      <div className="frow">
        <label className="hint" style={{ flex: 1, minWidth: 0 }}>Категория<Gr n={3} title="Категория (БДС ISO 11602-2)" />
          <select value={d.category} onChange={(e) => on({ category: e.target.value })} style={fieldStyle}>{CAT_OPTS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </label>
        <label className="hint" style={{ flex: 1, minWidth: 0 }}>Обща маса (кг)<Gr n={4} title="Маса на заредения пожарогасител" />
          <input value={d.totalMass} onChange={(e) => on({ totalMass: e.target.value })} style={fieldStyle} inputMode="decimal" placeholder="напр. 1,600" />
        </label>
      </div>
      <div className="frow">
        <label className="hint" style={{ flex: 1, minWidth: 0 }}>Сериен № (на корпуса)<Gr n={2} title="Ид. маркировка (сериен номер)" /><input value={d.serial} onChange={(e) => on({ serial: e.target.value })} style={fieldStyle} /></label>
        <label className="hint" style={{ flex: 1, minWidth: 0 }}>Година<Gr n={2} title="Ид. маркировка (година)" /><input type="number" value={d.year} onChange={(e) => on({ year: e.target.value })} style={fieldStyle} /></label>
      </div>
      <div className="frow">
        <label className="hint" style={{ flex: 1, minWidth: 0 }}>Вид дейност<Gr n={7} title="Вид на извършеното обслужване (ТО, П или ХИ)" />
          <select value={d.action} onChange={(e) => on({ action: e.target.value })} style={fieldStyle}>{KIND_OPTS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}</select>
        </label>
        <label className="hint" style={{ flex: 1, minWidth: 0 }}>Стикер №<Gr n={11} title="Номер на стикера" /><input value={d.sticker} onChange={(e) => on({ sticker: e.target.value })} style={fieldStyle} placeholder="номер на стикера" /></label>
      </div>
      {needsAgent && <label className="hint">Търговско наименование (при П/ХИ)<Gr n={6} title="Търговско наименование на веществото" /><input value={d.agentTrade} onChange={(e) => on({ agentTrade: e.target.value })} style={fieldStyle} placeholder="напр. Кобра ABC 50 / пенообразувател" /></label>}
    </div>
  );
}

function lineSummary(d: LineDraft): string {
  const t = TYPE_OPTS.find((x) => x.v === d.type)?.l ?? d.type;
  return [d.brand || d.model || t, d.serial && `№ ${d.serial}`, d.year].filter(Boolean).join(' · ');
}

export default function StickerScan() {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [sites, setSites] = useState<Site[]>([]);

  // Заглавна част (за целия протокол)
  const [protocolNo, setProtocolNo] = useState('');
  const [date, setDate] = useState(today());
  const [tech, setTech] = useState('Х. Христов');
  const [stickerStart, setStickerStart] = useState(''); // начален № на стикер → авто-инкремент по реда
  const [oName, setOName] = useState('');
  const [oAddr, setOAddr] = useState('');
  const [oPhone, setOPhone] = useState('');
  const [handedBy, setHandedBy] = useState('В. Вълков'); // ПРЕДАЛ + представител в увода
  const [receivedBy, setReceivedBy] = useState('');       // ПРИЕЛ (празно = собственика)
  const [oSiteId, setOSiteId] = useState<string | undefined>(undefined);
  const [pickedSite, setPickedSite] = useState('');
  const [loadMsg, setLoadMsg] = useState<string | null>(null);
  const [toEmail, setToEmail] = useState(''); // имейл получател (по избор; празно = EMAIL_TO/към мен)

  // Кошница (редовете) + текущ ред за добавяне
  const [cart, setCart] = useState<LineDraft[]>([]);
  const [draft, setDraft] = useState<LineDraft>(() => emptyDraft('draft'));
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [recMsg, setRecMsg] = useState<string | null>(null);

  const [gen, setGen] = useState(false);
  const [mail, setMail] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/sites').then((r) => r.json()).then((j) => setSites(j.sites ?? [])).catch(() => {});
    fetch('/api/protocols/next-number').then((r) => r.json()).then((j) => { if (j?.number) setProtocolNo(j.number); }).catch(() => {});
  }, []);

  const newId = () => `l${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const patchDraft = (p: Partial<LineDraft>) => setDraft((d) => ({ ...d, ...p }));

  async function onPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    try {
      const urls = await Promise.all(files.map(loadImageDataUrl));
      setPhotos((p) => [...p, ...urls].slice(0, 4));
    } catch { /* игнорирай развалена снимка */ }
    e.target.value = '';
  }

  async function recognize(effort?: 'high') {
    if (!photos.length) { setRecMsg('Добави поне една снимка.'); return; }
    setBusy(true); setRecMsg(null);
    try {
      const imageBase64List = photos.map((u) => u.split(',')[1] ?? '').filter(Boolean);
      const r = await fetch('/api/vision/sticker', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64List, ...(effort ? { effort } : {}) }),
      });
      const j = await r.json();
      if (!j.ok) { setRecMsg(`✗ ${j.error ?? 'Грешка при разпознаване'}`); return; }
      const mm = j.match; const ff = j.fields ?? {};
      const t = String(mm?.type ?? ff.type ?? draft.type);
      const cap = String(mm?.mass ?? ff.capacityKg ?? draft.cap ?? '');
      const dueMap: Record<string, string> = { TO: 'TO', recharge: 'TO_PZ', HI: 'TO_HI' };
      const act = dueMap[String(j.status?.dueAction ?? '')] ?? 'TO';
      setDraft((d) => small1kgDefaults({
        ...d,
        brand: (mm?.brand ?? ff.brand) ?? d.brand,
        model: (mm?.model ?? ff.model) ?? d.model,
        serial: String(mm?.serial ?? ff.serial ?? d.serial),
        year: String(mm?.year ?? ff.year ?? d.year),
        type: t,
        cap,
        totalMass: stdMass(t, cap) || d.totalMass,
        category: mm?.category || deriveCategory(t as ExtinguisherType),
        action: act,
      }));
      // Първият разпознат собственик попълва заглавната част (ако още е празна).
      if (mm && !oName.trim()) {
        setOName(mm.ownerName ?? ''); setOAddr(mm.ownerAddress ?? ''); setOPhone(mm.ownerPhone ?? '');
        if (mm.siteId) { setOSiteId(mm.siteId); setPickedSite(mm.siteId); }
      }
      setRecMsg(mm ? `✓ Разпознат и намерен (${mm.ownerName || mm.siteName})` : '✓ Разпознат — провери полетата и добави');
    } catch { setRecMsg('✗ Мрежова грешка'); } finally { setBusy(false); }
  }

  // Партидно разпознаване: всяка снимка = отделен гасител → отделен ред в кошницата.
  async function recognizeBatch() {
    if (!photos.length) { setRecMsg('Добави снимки (по една на гасител).'); return; }
    setBusy(true); setRecMsg(null);
    const dueMap: Record<string, string> = { TO: 'TO', recharge: 'TO_PZ', HI: 'TO_HI' };
    let added = 0;
    try {
      for (const p of photos) {
        const b64 = p.split(',')[1] ?? '';
        if (!b64) continue;
        const r = await fetch('/api/vision/sticker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64List: [b64] }) });
        const j = await r.json();
        if (!j.ok) continue;
        const mm = j.match; const ff = j.fields ?? {};
        const t = String(mm?.type ?? ff.type ?? 'powder_abc');
        const cap = String(mm?.mass ?? ff.capacityKg ?? '');
        const row = small1kgDefaults({
          ...emptyDraft(newId()),
          brand: (mm?.brand ?? ff.brand) ?? '',
          model: (mm?.model ?? ff.model) ?? '',
          serial: String(mm?.serial ?? ff.serial ?? ''),
          year: String(mm?.year ?? ff.year ?? ''),
          type: t, cap, totalMass: stdMass(t, cap),
          category: mm?.category || deriveCategory(t as ExtinguisherType),
          action: dueMap[String(j.status?.dueAction ?? '')] ?? 'TO',
        });
        setCart((c) => [...c, row]);
        added++;
        if (mm && !oName.trim()) { setOName(mm.ownerName ?? ''); setOAddr(mm.ownerAddress ?? ''); setOPhone(mm.ownerPhone ?? ''); if (mm.siteId) { setOSiteId(mm.siteId); setPickedSite(mm.siteId); } }
      }
      setPhotos([]);
      setRecMsg(added ? `✓ Добавени ${added} гасителя (по една снимка всеки)` : '✗ Нищо не се разпозна — провери снимките');
    } catch { setRecMsg('✗ Мрежова грешка'); } finally { setBusy(false); }
  }

  function addToCart() {
    if (!(draft.serial.trim() || draft.brand.trim() || draft.model.trim() || draft.cap.trim())) {
      setRecMsg('Добави поне марка/модел/сериен № или капацитет.');
      return;
    }
    setCart((c) => [...c, { ...small1kgDefaults(draft), id: newId() }]);
    setDraft(emptyDraft('draft')); setPhotos([]); setRecMsg(null);
  }
  const updateLine = (id: string, patch: Partial<LineDraft>) => setCart((c) => c.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) => setCart((c) => c.filter((l) => l.id !== id));

  async function loadFromSite(siteId: string) {
    setPickedSite(siteId); setOSiteId(siteId || undefined);
    if (!siteId) return;
    setLoadMsg('Зареждам…');
    try {
      const j = await fetch(`/api/protocols/from-site?siteId=${encodeURIComponent(siteId)}`).then((r) => r.json());
      if (!j.ok) { setLoadMsg(`✗ ${j.error ?? 'Грешка'}`); return; }
      setOName(j.ownerName ?? ''); setOAddr(j.ownerAddress ?? ''); setOPhone(j.ownerPhone ?? '');
      if (j.ownerEmail) setToEmail(j.ownerEmail);
      // Пълним САМО собственика — старите гасители на обекта НЕ се зареждат;
      // въвеждат се нови (сканиране/ръчно) за новия протокол.
      setLoadMsg('✓ Избран обект — сега добави новите гасители за протокола');
    } catch { setLoadMsg('✗ Мрежова грешка'); }
  }

  // Авто-номер на стикер (графа 11): от начален № нататък, по реда; пази водещите нули.
  function autoSticker(i: number, fallback: string): string {
    const digits = stickerStart.replace(/\D/g, '');
    if (!digits) return fallback;
    return String(Number(digits) + i).padStart(digits.length, '0');
  }

  const MAX_PER_PROTOCOL = 10; // лимит на гасители/протокол (двустранен печат с декларацията)
  // Разделя кошницата на протоколи по ≤10 гасителя; стикер-номерата текат непрекъснато през частите.
  function buildChunks(): ProtocolData[] {
    const groups: LineDraft[][] = [];
    for (let i = 0; i < cart.length; i += MAX_PER_PROTOCOL) groups.push(cart.slice(i, i + MAX_PER_PROTOCOL));
    const N = groups.length;
    const baseNo = protocolNo.trim();
    return groups.map((group, ci) => ({
      protocolNo: N > 1 ? `${baseNo}${baseNo ? ' ' : ''}(стр. ${ci + 1}/${N})` : baseNo,
      date: bg(date), city: 'Нова Загора', siteId: oSiteId,
      ownerName: oName, ownerAddress: oAddr, ownerPhone: oPhone,
      handedBy: handedBy.trim() || 'В. Вълков', receivedBy: receivedBy.trim() || oName,
      lines: group.map((d, i) => draftToLine({ ...d, date, tech, sticker: autoSticker(ci * MAX_PER_PROTOCOL + i, d.sticker) }, i + 1)),
    }));
  }

  const canGenerate = cart.length > 0; // собственикът вече не е задължителен — всяко поле е свободно
  const genHint = cart.length === 0 ? 'Добави поне един гасител в протокола.' : '';
  const splitNote = cart.length > MAX_PER_PROTOCOL ? `Над ${MAX_PER_PROTOCOL} гасителя → ще се генерират ${Math.ceil(cart.length / MAX_PER_PROTOCOL)} протокола по ≤${MAX_PER_PROTOCOL} (за двустранен печат).` : '';

  async function generateWord() {
    if (!canGenerate) { setMail(genHint); return; }
    setGen(true); setMail(null);
    try {
      const chunks = buildChunks();
      for (let k = 0; k < chunks.length; k++) {
        const r = await fetch('/api/protocols/custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(chunks[k]) });
        if (!r.ok) { setMail('✗ Грешка при генериране'); return; }
        const blob = await r.blob();
        const cd = r.headers.get('Content-Disposition') ?? '';
        const name = /filename="(.+?)"/.exec(cd)?.[1] ?? `protokol-${k + 1}.docx`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = name; a.click();
        URL.revokeObjectURL(url);
        if (chunks.length > 1) await new Promise((res) => setTimeout(res, 400)); // пауза между сваляния
      }
      setMail(`✓ Свалени ${chunks.length} протокол(а) с ${cart.length} гасителя`);
    } catch { setMail('✗ Мрежова грешка'); } finally { setGen(false); }
  }

  async function sendEmail() {
    if (!canGenerate) { setMail(genHint); return; }
    setGen(true); setMail(null);
    try {
      const r = await fetch('/api/protocols/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ protocols: buildChunks(), to: toEmail.trim() || undefined }) });
      const j = await r.json();
      setMail(j.ok ? `✓ Изпратено по имейл (${j.count} протокол(а) № ${j.protocolNo}, ${cart.length} гасителя)` : `✗ ${j.error ?? 'Имейлът не е изпратен'}`);
    } catch { setMail('✗ Мрежова грешка'); } finally { setGen(false); }
  }

  const btnBig: React.CSSProperties = { fontSize: 16, padding: '14px 20px', flex: '1 1 200px' };

  return (
    <div className="scan-box" style={{ marginTop: 8, maxWidth: 640 }}>
      <datalist id="brand-list">{BRANDS.map((b) => <option key={b} value={b} />)}</datalist>
      <datalist id="email-list">{[...new Set(sites.map((s) => s.ownerEmail).filter(Boolean))].map((e) => <option key={e} value={e} />)}</datalist>

      <div className="sec-h"><h2>🧯 Протокол с пожарогасители</h2></div>
      <p className="hint" style={{ marginBottom: 12 }}>Добави няколко гасителя в <b>един протокол</b> — чрез сканиране или „Зареди от обект". Всяко поле е редактируемо.</p>

      {/* Заглавна част */}
      <div style={{ display: 'grid', gap: 10, border: '1px solid var(--line2)', borderRadius: 14, padding: 16 }}>
        <div className="frow">
          <label className="hint" style={{ flex: 1, minWidth: 0 }}>Номер на протокол <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(примерен)</span><input value={protocolNo} onChange={(e) => setProtocolNo(e.target.value)} style={fieldStyle} placeholder="напр. 6/2026" /></label>
          <label className="hint" style={{ flex: 1, minWidth: 0 }}>Дата<input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle} /></label>
        </div>
        <label className="hint">Техник (извършил обслужването)<input value={tech} onChange={(e) => setTech(e.target.value)} style={fieldStyle} placeholder="напр. Х. Христов" /></label>
        <label className="hint">Начален № на стикер<Gr n={11} title="Номер на стикера — авто-номерация по реда" /><span style={{ color: 'var(--muted)', fontWeight: 400 }}> (авто за всеки ред; празно = ръчно на ред)</span><input value={stickerStart} onChange={(e) => setStickerStart(e.target.value)} style={fieldStyle} inputMode="numeric" placeholder="напр. 1001 → 1001, 1002, 1003…" /></label>
        <label className="hint" style={{ color: 'var(--soon)' }}>🏢 Избери обект — попълва собственика (по избор)
          <select value={pickedSite} onChange={(e) => loadFromSite(e.target.value)} style={fieldStyle}>
            <option value="">— избери обект —</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.siteName} · {s.ownerName}</option>)}
          </select>
        </label>
        {loadMsg && <p className="hint" style={{ color: loadMsg.startsWith('✓') ? 'var(--ok)' : 'var(--soon)' }}>{loadMsg}</p>}
        <label className="hint">Собственик / клиент (под таблицата)<input value={oName} onChange={(e) => setOName(e.target.value)} style={fieldStyle} placeholder="напр. ЕТ Иванов" /></label>
        <div className="frow">
          <label className="hint" style={{ flex: 2, minWidth: 0 }}>Адрес<input value={oAddr} onChange={(e) => setOAddr(e.target.value)} style={fieldStyle} /></label>
          <label className="hint" style={{ flex: 1, minWidth: 0 }}>Телефон<input value={oPhone} onChange={(e) => setOPhone(e.target.value)} style={fieldStyle} inputMode="tel" /></label>
        </div>
        <div className="frow">
          <label className="hint" style={{ flex: 1, minWidth: 0 }}>Предал <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(представител на сервиза)</span><input value={handedBy} onChange={(e) => setHandedBy(e.target.value)} style={fieldStyle} placeholder="напр. В. Вълков" /></label>
          <label className="hint" style={{ flex: 1, minWidth: 0 }}>Приел <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(приемащ)</span><input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} style={fieldStyle} placeholder="празно = собственика" /></label>
        </div>
      </div>

      {/* Кошница */}
      <div className="sec-h" style={{ marginTop: 18 }}><h2>Гасители в протокола ({cart.length})</h2></div>
      {cart.length === 0 && <p className="hint">Още няма добавени. Сканирай или зареди от обект.</p>}
      {cart.map((l, i) => (
        <div key={l.id} style={{ border: '1px solid var(--line2)', borderRadius: 14, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <b style={{ fontSize: 14 }}>{i + 1}. {lineSummary(l)}</b>
            <button type="button" className="btn" onClick={() => removeLine(l.id)} style={{ border: '1px solid var(--line2)', color: 'inherit', padding: '6px 12px', fontSize: 13 }}>🗑 Премахни</button>
          </div>
          <LineFields d={l} on={(p) => updateLine(l.id, p)} />
        </div>
      ))}

      {/* Добавяне на нов гасител */}
      <div style={{ border: '1px dashed var(--line2)', borderRadius: 14, padding: 16, marginTop: 8 }}>
        <p className="hint" style={{ marginTop: 0, color: 'var(--soon)' }}>➕ Добави гасител (снимай 1–3 снимки за по-добро разпознаване, после провери/редактирай)</p>
        <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={onPhotos} style={{ display: 'none' }} />
        <input ref={galRef} type="file" accept="image/*" multiple onChange={onPhotos} style={{ display: 'none' }} />
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button className="btn" style={{ ...btnBig, border: '1px solid var(--line2)', color: 'inherit' }} disabled={busy} onClick={() => camRef.current?.click()}>📷 Снимай</button>
          <button className="btn" style={{ ...btnBig, border: '1px solid var(--line2)', color: 'inherit' }} disabled={busy} onClick={() => galRef.current?.click()}>🖼️ Качи снимки</button>
        </div>
        {photos.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {photos.map((p, idx) => (
              <div key={idx} style={{ position: 'relative' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt={`снимка ${idx + 1}`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                <button type="button" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== idx))} style={{ position: 'absolute', top: -6, right: -6, background: 'var(--over)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 12, lineHeight: '20px', padding: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}
        {photos.length > 0 && (
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn btn-fire" style={btnBig} disabled={busy} onClick={() => recognize()}>{busy ? '🔎 Разпознавам…' : `🔎 Разпознай (${photos.length} сн. = 1 гасител)`}</button>
            <button className="btn" style={{ ...btnBig, flex: '0 0 auto', border: '1px solid var(--line2)', color: 'inherit' }} disabled={busy} onClick={() => recognize('high')} title="По-силно вглеждане за дребен/щампован текст">🔍 По-добре</button>
          </div>
        )}
        {photos.length > 1 && (
          <button className="btn" style={{ ...btnBig, marginTop: 8, width: '100%', border: '1px solid var(--soon)', color: 'inherit' }} disabled={busy} onClick={recognizeBatch}>📚 Всяка снимка = отделен гасител ({photos.length} бр.)</button>
        )}
        {recMsg && <p className="hint" style={{ marginTop: 10, color: recMsg.startsWith('✗') ? 'var(--over)' : 'var(--ok)' }}>{recMsg}</p>}

        <div style={{ marginTop: 14 }}>
          <LineFields d={draft} on={patchDraft} />
        </div>
        <button className="btn btn-fire" style={{ ...btnBig, marginTop: 14, width: '100%' }} onClick={addToCart}>➕ Добави в протокола</button>
      </div>

      {/* Имейл получател + генериране */}
      <label className="hint" style={{ display: 'block', marginTop: 18 }}>📧 Изпрати протокола на (имейл) <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(по избор; празно = към мен)</span>
        <input list="email-list" value={toEmail} onChange={(e) => setToEmail(e.target.value)} style={fieldStyle} inputMode="email" placeholder="напр. klient@firma.bg" />
      </label>
      {splitNote && <p className="hint" style={{ marginTop: 8, color: 'var(--soon)' }}>📄 {splitNote}</p>}
      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn btn-fire" style={btnBig} disabled={gen || !canGenerate} onClick={generateWord}>📄 Генерирай Word</button>
        <button className="btn" style={{ ...btnBig, border: '1px solid var(--line2)', color: 'inherit' }} disabled={gen || !canGenerate} onClick={sendEmail}>✉ Изпрати на имейл</button>
      </div>
      {!canGenerate && genHint && <p className="hint" style={{ marginTop: 8, color: 'var(--soon)' }}>{genHint}</p>}
      {mail && <p className="hint" style={{ marginTop: 10, color: mail.startsWith('✓') ? 'var(--ok)' : 'var(--over)' }}>{mail}</p>}

      <p className="hint" style={{ marginTop: 18 }}>или <Link href="/" style={{ color: 'var(--soon)' }}>избери ръчно от обектите →</Link></p>
    </div>
  );
}
