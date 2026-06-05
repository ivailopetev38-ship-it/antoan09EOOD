import { createServiceClient } from '@/lib/supabase/server';
import { computeExtinguisherStatus } from '@/lib/regulatory/engine';
import type { ExtinguisherType } from '@/lib/regulatory/types';
import { nextProtocolNumber } from './protocolNumber';
import { generateProtocolDocx } from './generateDocx';
import type { ProtocolData, ProtocolLineData } from './types';

const AGENT_LABEL: Record<ExtinguisherType, string> = {
  powder_abc: 'Прах', powder_bc: 'Прах', water: 'Вода', foam: 'Пяна', co2: 'CO2',
};
const ACTION_LABEL: Record<string, string> = { TO: 'ТО', recharge: 'П', HI: 'ХИ', scrap: 'БРАК' };

function bgDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

interface History {
  lastTO: string | null;
  lastRecharge: string | null;
  lastHI: string | null;
}

export type BuildResult =
  | { ok: true; buffer: Buffer; protocolNo: string; filename: string }
  | { ok: false; status: number; error: string };

/** Сглобява и генерира протокол (Приложение № 9) за обект (или единичен пожарогасител). */
export async function buildProtocol(opts: { siteId?: string; extinguisherId?: string }): Promise<BuildResult> {
  const siteId = opts.siteId;
  if (!siteId) return { ok: false, status: 400, error: 'siteId е задължителен' };

  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));

  const { data: site, error: siteErr } = await supabase
    .from('sites').select('id,name,address,clients(name,address,phone)').eq('id', siteId).single();
  if (siteErr || !site) return { ok: false, status: 404, error: 'Обектът не е намерен' };

  const { data: exts, error: extErr } = await supabase
    .from('extinguishers').select('*').eq('site_id', siteId).order('created_at');
  if (extErr) return { ok: false, status: 500, error: 'Грешка при четене на пожарогасители' };

  const extListAll = exts ?? [];
  const extList = opts.extinguisherId
    ? extListAll.filter((e) => e.id === opts.extinguisherId)
    : extListAll;

  const ids = extList.map((e) => e.id);
  const history: Record<string, History> = {};
  if (ids.length) {
    const { data: events } = await supabase
      .from('service_events').select('extinguisher_id,kind,service_date').in('extinguisher_id', ids);
    for (const ev of events ?? []) {
      const h = (history[ev.extinguisher_id] ??= { lastTO: null, lastRecharge: null, lastHI: null });
      const d = ev.service_date as string;
      if (ev.kind === 'TO') {
        if (!h.lastTO || d > h.lastTO) h.lastTO = d;
      } else if (ev.kind === 'HI') {
        if (!h.lastHI || d > h.lastHI) h.lastHI = d;
      } else if (ev.kind === 'recharge' || ev.kind === 'powder_change' || ev.kind === 'foam_change') {
        if (!h.lastRecharge || d > h.lastRecharge) h.lastRecharge = d;
      }
    }
  }

  // Бракуваните не влизат в протокол за предаване.
  const built: { line: ProtocolLineData; extinguisherId: string }[] = [];
  for (const e of extList) {
    const h = history[e.id] ?? { lastTO: null, lastRecharge: null, lastHI: null };
    const status = computeExtinguisherStatus({
      type: e.type,
      manufactureYear: e.manufacture_year,
      stampYear: e.stamp_year,
      lastTO: h.lastTO,
      lastRecharge: h.lastRecharge,
      lastHI: h.lastHI,
      today,
    });
    if (status.isScrapped) continue;
    built.push({
      extinguisherId: e.id,
      line: {
        idx: built.length + 1,
        markings: `${e.model ?? ''} № ${e.serial_number ?? ''} / ${e.manufacture_year}`.trim(),
        category: e.category ?? '',
        mass: e.mass_kg != null ? Number(e.mass_kg).toFixed(3).replace('.', ',') : '',
        agent: AGENT_LABEL[e.type as ExtinguisherType] ?? '',
        agentTradeName: '',
        serviceKind: ACTION_LABEL[status.suggestedAction] ?? '',
        serviceDate: bgDate(today),
        technicianName: 'Х. Христов',
        stickerNo: '',
      },
    });
  }
  const lines = built.map((b) => b.line);

  const { count } = await supabase
    .from('protocols').select('*', { count: 'exact', head: true })
    .gte('protocol_date', `${year}-01-01`);
  const protocolNo = nextProtocolNumber(year, count ?? 0);

  const { data: inserted } = await supabase
    .from('protocols')
    .insert({ number: protocolNo, protocol_date: today, site_id: siteId, representative: 'В. Вълков' })
    .select('id').single();
  if (inserted?.id && built.length) {
    await supabase.from('protocol_lines').insert(
      built.map((b) => ({
        protocol_id: inserted.id,
        extinguisher_id: b.extinguisherId,
        idx: b.line.idx,
        markings: b.line.markings,
        category: b.line.category,
        mass_kg: b.line.mass,
        agent: b.line.agent,
        agent_trade_name: b.line.agentTradeName,
        service_kind: b.line.serviceKind,
        service_date: b.line.serviceDate,
        technician_name: b.line.technicianName,
        sticker_no: b.line.stickerNo,
      })),
    );
  }

  const clientRaw = (site as unknown as { clients?: unknown }).clients;
  const client = (Array.isArray(clientRaw) ? clientRaw[0] : clientRaw) as
    | { name?: string; address?: string; phone?: string }
    | undefined;

  const data: ProtocolData = {
    protocolNo,
    date: bgDate(today),
    city: 'Нова Загора',
    ownerName: client?.name ?? '',
    ownerAddress: client?.address ?? '',
    ownerPhone: client?.phone ?? '',
    lines,
  };

  const buffer = generateProtocolDocx(data);
  return { ok: true, buffer, protocolNo, filename: `protokol-${protocolNo.replace('/', '-')}.docx` };
}
