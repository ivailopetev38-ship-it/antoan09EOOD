import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Body {
  siteId?: string; extinguisherId?: string;
  clientName?: string; siteName?: string;
  model?: string; serial?: string; action?: string;
  dueDate?: string; note?: string;
}

/** Насрочва напомняне за повторно обслужване на конкретна дата (1г/2г/ръчно). */
export async function POST(req: Request) {
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Невалиден JSON' }, { status: 400 });
  }
  if (!b.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate)) {
    return NextResponse.json({ ok: false, error: 'Липсва/невалидна дата (ГГГГ-ММ-ДД)' }, { status: 400 });
  }
  const db = createServiceClient();
  const { data, error } = await db
    .from('reminders')
    .insert({
      site_id: b.siteId || null,
      extinguisher_id: b.extinguisherId || null,
      client_name: b.clientName || null,
      site_name: b.siteName || null,
      model: b.model || null,
      serial: b.serial || null,
      action: b.action || null,
      due_date: b.dueDate,
      note: b.note || null,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id, dueDate: b.dueDate });
}
