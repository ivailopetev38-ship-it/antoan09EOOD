import { NextResponse } from 'next/server';
import { generateCustomProtocol } from '@/lib/protocol/custom';
import { getEmailProvider } from '@/lib/email/provider';
import type { ProtocolData } from '@/lib/protocol/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { protocol?: ProtocolData; protocols?: ProtocolData[]; to?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Невалиден JSON' }, { status: 400 });
  }
  // Приема единичен `protocol` или списък `protocols` (при > 10 гасителя → няколко протокола по ≤10).
  const list = (body.protocols?.length ? body.protocols : body.protocol ? [body.protocol] : [])
    .filter((d): d is ProtocolData => !!d && Array.isArray(d.lines) && d.lines.length > 0);
  // Получател = EMAIL_TO (към мен по подразбиране). EMAIL_BCC по избор.
  const to = (body.to || process.env.EMAIL_TO || '').trim();
  const bcc = (process.env.EMAIL_BCC || '').trim() || undefined;
  if (!list.length) {
    return NextResponse.json({ ok: false, error: 'Няма редове за протокол' }, { status: 400 });
  }
  if (!to) {
    return NextResponse.json({ ok: false, error: 'Няма получател (EMAIL_TO)' }, { status: 400 });
  }

  // Генерира всеки протокол (последователно — за коректна номерация в дневника).
  const gen: { buffer: Buffer; filename: string; protocolNo: string }[] = [];
  for (const data of list) gen.push(await generateCustomProtocol(data));

  const attachments = gen.map((g) => ({ filename: g.filename, content: g.buffer.toString('base64') }));
  const owner = list[0].ownerName;
  const nums = gen.map((g) => g.protocolNo).join(', ');
  const many = gen.length > 1;
  const html =
    `<p>Здравейте,</p>` +
    `<p>Прикачен${many ? `и са ${gen.length} предавателни протокола` : ' е предавателен протокол'} ` +
    `<b>№ ${nums}</b>${owner ? ` за <b>${owner}</b>` : ''}.</p>` +
    `<p>Поздрави,<br/>АНТОАН-09</p>`;

  const r = await getEmailProvider().send({
    to,
    bcc,
    subject: `Протокол${many ? 'и' : ''} № ${nums}${owner ? ` · ${owner}` : ''}`,
    html,
    attachments,
  });
  return NextResponse.json({ ok: r.sent, provider: r.provider, id: r.id, error: r.error, protocolNo: nums, count: gen.length });
}
