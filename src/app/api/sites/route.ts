import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

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
