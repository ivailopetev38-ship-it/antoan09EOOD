import { NextResponse } from 'next/server';
import { composeReminder, type ReminderItem } from '@/lib/notify/message';
import { getNotifyProvider } from '@/lib/notify/provider';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let b: Partial<ReminderItem>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Невалиден JSON' }, { status: 400 });
  }
  if (!b.clientName || !b.siteName || !b.nextDue) {
    return NextResponse.json({ ok: false, error: 'Липсват полета' }, { status: 400 });
  }
  const text = composeReminder({
    clientName: b.clientName,
    siteName: b.siteName,
    model: b.model ?? null,
    serial: b.serial ?? null,
    action: b.action ?? null,
    nextDue: b.nextDue,
    overdue: b.overdue ?? false,
  });
  try {
    const r = await getNotifyProvider().send(text);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
