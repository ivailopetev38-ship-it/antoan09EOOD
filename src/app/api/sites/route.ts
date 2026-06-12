import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { findOrCreateSite } from '@/lib/import/site';

export const dynamic = 'force-dynamic';

// Списък с обекти (за избор при непознат гасител).
export async function GET() {
  const db = createServiceClient();
  const { data } = await db
    .from('sites')
    .select('id, name, address, clients(name, address, phone)')
    .order('name');
  const sites = ((data ?? []) as Array<{
    id: string;
    name: string;
    address: string | null;
    clients: { name?: string; address?: string; phone?: string } | { name?: string; address?: string; phone?: string }[] | null;
  }>).map((s) => {
    const cl = Array.isArray(s.clients) ? s.clients[0] : s.clients;
    return {
      id: s.id,
      siteName: s.name,
      ownerName: cl?.name ?? '',
      ownerAddress: cl?.address ?? s.address ?? '',
      ownerPhone: cl?.phone ?? '',
    };
  });
  return NextResponse.json({ sites });
}

// Създава нов обект (и клиент, ако е нов). Идемпотентно по име.
export async function POST(req: Request) {
  let b: { clientName?: string; siteName?: string; address?: string; phone?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Невалиден JSON' }, { status: 400 });
  }
  if (!b.clientName?.trim() || !b.siteName?.trim()) {
    return NextResponse.json({ ok: false, error: 'Липсва име на клиент или обект' }, { status: 400 });
  }
  try {
    const r = await findOrCreateSite(createServiceClient(), {
      clientName: b.clientName,
      siteName: b.siteName,
      address: b.address,
      phone: b.phone,
    });
    return NextResponse.json({ ok: true, siteId: r.siteId, createdSite: r.createdSite });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
