import { createServiceClient } from '@/lib/supabase/server';
import { getSiteDrafts } from './siteDrafts';
import { draftToLine } from './draft';
import { nextProtocolNumber } from './protocolNumber';
import { generateProtocolDocx } from './generateDocx';
import type { ProtocolData } from './types';

function bgDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export type BuildResult =
  | { ok: true; buffer: Buffer; protocolNo: string; filename: string }
  | { ok: false; status: number; error: string };

/** Сглобява и генерира протокол (Приложение № 9) за обект (или единичен пожарогасител).
 *  Ползва общия `getSiteDrafts` + `draftToLine`, за да е форматът еднакъв с кошницата. */
export async function buildProtocol(opts: { siteId?: string; extinguisherId?: string }): Promise<BuildResult> {
  if (!opts.siteId) return { ok: false, status: 400, error: 'siteId е задължителен' };

  const sd = await getSiteDrafts(opts.siteId);
  if (!sd.ok) return { ok: false, status: sd.status, error: sd.error ?? 'Грешка' };

  const drafts = opts.extinguisherId ? sd.lines.filter((d) => d.id === opts.extinguisherId) : sd.lines;
  const lines = drafts.map((d, i) => draftToLine(d, i + 1));

  const db = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));

  const { count } = await db
    .from('protocols').select('*', { count: 'exact', head: true })
    .gte('protocol_date', `${year}-01-01`);
  const protocolNo = nextProtocolNumber(year, count ?? 0);

  const { data: inserted } = await db
    .from('protocols')
    .insert({ number: protocolNo, protocol_date: today, site_id: opts.siteId, representative: 'В. Вълков' })
    .select('id').single();
  if (inserted?.id && drafts.length) {
    await db.from('protocol_lines').insert(
      drafts.map((d, i) => {
        const ln = draftToLine(d, i + 1);
        return {
          protocol_id: inserted.id,
          extinguisher_id: d.id,
          idx: ln.idx,
          markings: ln.markings,
          category: ln.category,
          mass_kg: ln.mass,
          agent: ln.agent,
          agent_trade_name: ln.agentTradeName,
          service_kind: ln.serviceKind,
          service_date: ln.serviceDate,
          technician_name: ln.technicianName,
          sticker_no: ln.stickerNo,
        };
      }),
    );
  }

  const data: ProtocolData = {
    protocolNo,
    date: bgDate(today),
    city: 'Нова Загора',
    ownerName: sd.ownerName,
    ownerAddress: sd.ownerAddress,
    ownerPhone: sd.ownerPhone,
    lines,
  };

  const buffer = generateProtocolDocx(data);
  return { ok: true, buffer, protocolNo, filename: `protokol-${protocolNo.replace('/', '-')}.docx` };
}
