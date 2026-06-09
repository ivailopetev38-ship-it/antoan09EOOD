import Link from 'next/link';
import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { getEnrichedExtinguishers } from '@/lib/dashboard/queries';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  powder_abc: 'Прахов ABC', powder_bc: 'Прахов BC', water: 'Воден', foam: 'Водопенен', co2: 'CO₂',
};

export default async function QrSheetPage() {
  const h = await headers();
  const host = h.get('host') ?? 'antoan09-eood.vercel.app';
  const proto = h.get('x-forwarded-proto') ?? 'https';

  const exts = await getEnrichedExtinguishers();
  const withQr = await Promise.all(
    exts.map(async (e) => ({
      e,
      qr: await QRCode.toDataURL(`${proto}://${host}/pg/${e.id}`, {
        margin: 1, width: 200, color: { dark: '#000000', light: '#ffffff' },
      }),
    })),
  );

  const groups = new Map<string, typeof withQr>();
  for (const item of withQr) {
    const key = item.e.siteName || '—';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  return (
    <div className="wrap qr-page">
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>🏷️ QR етикети за печат</h1>
          <p className="hint">Общо {exts.length} гасителя. Принтирай, изрежи и залепи всеки QR на съответния гасител — после се сканира от „📷 Сканирай".</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <PrintButton />
          <Link className="btn" href="/" style={{ border: '1px solid var(--line2)', color: 'inherit' }}>← Назад</Link>
        </div>
      </div>

      {exts.length === 0 && <p className="hint" style={{ marginTop: 20 }}>Няма гасители в базата.</p>}

      {[...groups.entries()].map(([siteName, items]) => (
        <section key={siteName} style={{ marginTop: 18 }}>
          <h2 className="qr-site-h">{siteName} <span className="qr-count">· {items.length} бр.</span></h2>
          <div className="qr-sheet">
            {items.map(({ e, qr }) => (
              <div key={e.id} className="qr-label">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt={`QR ${e.serial_number ?? ''}`} />
                <div className="qr-label-txt">
                  <div className="qr-serial">№ {e.serial_number ?? '—'}</div>
                  <div className="qr-meta">{e.model || TYPE_LABEL[e.type] || ''}</div>
                  <div className="qr-meta">{e.siteName}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
