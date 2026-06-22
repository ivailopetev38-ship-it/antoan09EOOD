import { NextResponse } from 'next/server';
import { getSiteDrafts } from '@/lib/protocol/siteDrafts';

export const dynamic = 'force-dynamic';

/** Връща (небракуваните) гасители на обект като редактируеми редове за кошницата. */
export async function GET(req: Request) {
  const siteId = new URL(req.url).searchParams.get('siteId') ?? '';
  if (!siteId) return NextResponse.json({ ok: false, error: 'Липсва siteId' }, { status: 400 });
  const sd = await getSiteDrafts(siteId);
  if (!sd.ok) return NextResponse.json({ ok: false, error: sd.error }, { status: sd.status });
  return NextResponse.json({
    ok: true,
    ownerName: sd.ownerName,
    ownerAddress: sd.ownerAddress,
    ownerPhone: sd.ownerPhone,
    siteId: sd.siteId,
    lines: sd.lines,
  });
}
