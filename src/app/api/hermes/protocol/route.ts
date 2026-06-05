import { NextRequest, NextResponse } from 'next/server';
import { requireHermesAuth } from '@/lib/hermes/auth';
import { buildProtocol } from '@/lib/protocol/build';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = requireHermesAuth(req);
  if (denied) return denied;

  let body: { siteId?: string; extinguisherId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Невалиден JSON' }, { status: 400 });
  }

  const res = await buildProtocol({
    siteId: body?.siteId,
    extinguisherId: typeof body?.extinguisherId === 'string' ? body.extinguisherId : undefined,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  return new NextResponse(new Uint8Array(res.buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${res.filename}"`,
    },
  });
}
