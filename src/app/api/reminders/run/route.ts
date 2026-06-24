import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { composeReminder } from '@/lib/notify/message';
import { getNotifyProvider } from '@/lib/notify/provider';

export const dynamic = 'force-dynamic';

/** Изпраща насрочените напомняния с настъпила дата (sent=false, due_date<=днес).
 *  Защита: хедър x-vercel-cron (Vercel Cron) или ?key=CRON_SECRET. Вика се ежедневно. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const key = new URL(req.url).searchParams.get('key');
  const isCron = req.headers.get('x-vercel-cron') != null;
  if (secret && !isCron && key !== secret) {
    return NextResponse.json({ ok: false, error: 'Неоторизиран' }, { status: 401 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const db = createServiceClient();
  const { data } = await db
    .from('reminders')
    .select('*')
    .eq('sent', false)
    .lte('due_date', today)
    .limit(100);
  const due = data ?? [];
  let sent = 0;
  for (const r of due) {
    const text = composeReminder({
      clientName: r.client_name ?? '',
      siteName: r.site_name ?? '',
      model: r.model ?? null,
      serial: r.serial ?? null,
      action: null,
      nextDue: r.due_date,
      overdue: r.due_date < today,
    });
    try {
      await getNotifyProvider().send(text);
      await db.from('reminders').update({ sent: true }).eq('id', r.id);
      sent++;
    } catch {
      /* мрежова грешка → остава за следващото пускане */
    }
  }
  return NextResponse.json({ ok: true, due: due.length, sent });
}
