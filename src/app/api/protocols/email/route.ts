import { NextResponse } from 'next/server';
import { generateCustomProtocol } from '@/lib/protocol/custom';
import { getEmailProvider } from '@/lib/email/provider';
import type { ProtocolData } from '@/lib/protocol/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { protocol?: ProtocolData; to?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Невалиден JSON' }, { status: 400 });
  }
  const data = body.protocol;
  // Получател = EMAIL_TO (клиентът). EMAIL_BCC (скрито копие) е по избор и в момента
  // НЕ е зададено → протоколът се праща САМО към клиента.
  const to = (body.to || process.env.EMAIL_TO || '').trim();
  const bcc = (process.env.EMAIL_BCC || '').trim() || undefined;
  if (!data || !Array.isArray(data.lines) || data.lines.length === 0) {
    return NextResponse.json({ ok: false, error: 'Няма редове за протокол' }, { status: 400 });
  }
  if (!to) {
    return NextResponse.json({ ok: false, error: 'Няма получател (EMAIL_TO)' }, { status: 400 });
  }
  const { buffer, filename, protocolNo } = await generateCustomProtocol(data);
  const html =
    `<p>Здравейте,</p>` +
    `<p>Прикачен е предавателен протокол <b>№ ${protocolNo}</b> за <b>${data.ownerName}</b>.</p>` +
    `<p>Поздрави,<br/>АНТОАН-09</p>`;
  const r = await getEmailProvider().send({
    to,
    bcc,
    subject: `Протокол № ${protocolNo} · ${data.ownerName}`,
    html,
    attachments: [{ filename, content: buffer.toString('base64') }],
  });
  return NextResponse.json({ ok: r.sent, provider: r.provider, id: r.id, error: r.error, filename, protocolNo });
}
