import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { computeExtinguisherStatus } from '@/lib/regulatory/engine';
import type { ExtinguisherType } from '@/lib/regulatory/types';
import { nextProtocolNumber } from '@/lib/protocol/protocolNumber';
import { generateProtocolDocx } from '@/lib/protocol/generateDocx';
import type { ProtocolData, ProtocolLineData } from '@/lib/protocol/types';

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

export async function POST(req: NextRequest) {
  let siteId: string | undefined;
  try {
    const body = await req.json();
    siteId = body?.siteId;
  } catch {
    return NextResponse.json({ error: 'Невалиден JSON' }, { status: 400 });
  }
  if (!siteId) return NextResponse.json({ error: 'siteId е задължителен' }, { status: 400 });

  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));

  const { data: site, error: siteErr } = await supabase
    .from('sites').select('id,name,address,clients(name,address,phone)').eq('id', siteId).single();
  if (siteErr || !site) return NextResponse.json({ error: 'Обектът не е намерен' }, { status: 404 });

  const { data: exts, error: extErr } = await supabase
    .from('extinguishers').select('*').eq('site_id', siteId).order('created_at');
  if (extErr) return NextResponse.json({ error: 'Грешка при четене на пожарогасители' }, { status: 500 });
  const extList = exts ?? [];

  // Последна дейност по вид за всеки пожарогасител (от историята)
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

  // Редове на протокола. Бракуваните НЕ влизат в протокола за предаване
  // (двигателят пак ги засича — те се проследяват отделно).
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

  // Пореден номер за годината (преди записа)
  const { count } = await supabase
    .from('protocols').select('*', { count: 'exact', head: true })
    .gte('protocol_date', `${year}-01-01`);
  const protocolNo = nextProtocolNumber(year, count ?? 0);

  // Запис в историята → номерът расте + проследимост
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

  const buf = generateProtocolDocx(data);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="protokol-${protocolNo.replace('/', '-')}.docx"`,
    },
  });
}
