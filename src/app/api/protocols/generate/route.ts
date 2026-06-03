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

export async function POST(req: NextRequest) {
  const { siteId } = await req.json();
  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: site } = await supabase
    .from('sites').select('id,name,address,clients(name,address,phone)').eq('id', siteId).single();
  if (!site) return NextResponse.json({ error: 'site not found' }, { status: 404 });

  const { data: exts } = await supabase
    .from('extinguishers').select('*').eq('site_id', siteId).order('created_at');

  const { count } = await supabase
    .from('protocols').select('*', { count: 'exact', head: true })
    .gte('protocol_date', `${today.slice(0, 4)}-01-01`);

  const lines: ProtocolLineData[] = (exts ?? []).map((e, i) => {
    const status = computeExtinguisherStatus({
      type: e.type, manufactureYear: e.manufacture_year, stampYear: e.stamp_year,
      lastTO: null, lastRecharge: null, lastHI: null, today,
    });
    return {
      idx: i + 1,
      markings: `${e.model ?? ''} № ${e.serial_number ?? ''} / ${e.manufacture_year}`.trim(),
      category: e.category ?? '',
      mass: e.mass_kg != null ? String(e.mass_kg).replace('.', ',') : '',
      agent: AGENT_LABEL[e.type as ExtinguisherType],
      agentTradeName: '',
      serviceKind: ACTION_LABEL[status.suggestedAction],
      serviceDate: bgDate(today),
      technicianName: 'Х. Христов',
      stickerNo: '',
    };
  });

  const clientRaw = (site as unknown as { clients?: unknown }).clients;
  const client = (Array.isArray(clientRaw) ? clientRaw[0] : clientRaw) as
    | { name?: string; address?: string; phone?: string }
    | undefined;
  const data: ProtocolData = {
    protocolNo: nextProtocolNumber(Number(today.slice(0, 4)), count ?? 0),
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
      'Content-Disposition': `attachment; filename="protokol-${data.protocolNo.replace('/', '-')}.docx"`,
    },
  });
}
