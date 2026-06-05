import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const KINDS = ['TO', 'recharge', 'powder_change', 'foam_change', 'HI'];

export async function POST(req: Request) {
  let b: {
    extinguisherId?: string;
    kind?: string;
    serviceDate?: string;
    technicianName?: string;
    agentTradeName?: string;
    notes?: string;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Невалиден JSON' }, { status: 400 });
  }
  if (!b.extinguisherId || !b.kind || !b.serviceDate) {
    return NextResponse.json({ ok: false, error: 'Липсват задължителни полета' }, { status: 400 });
  }
  if (!KINDS.includes(b.kind)) {
    return NextResponse.json({ ok: false, error: 'Невалиден вид дейност' }, { status: 400 });
  }
  const db = createServiceClient();
  const { error } = await db.from('service_events').insert({
    extinguisher_id: b.extinguisherId,
    kind: b.kind,
    service_date: b.serviceDate,
    technician_name: b.technicianName || null,
    agent_trade_name: b.agentTradeName || null,
    notes: b.notes || null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
