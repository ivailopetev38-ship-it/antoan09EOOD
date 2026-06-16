import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { nextProtocolNumber } from '@/lib/protocol/protocolNumber';

export const dynamic = 'force-dynamic';

/** Връща предложен следващ номер на протокол (пореден за тази година + 1), за пред-попълване. */
export async function GET() {
  const year = new Date().getFullYear();
  try {
    const db = createServiceClient();
    const { count } = await db
      .from('protocols')
      .select('*', { count: 'exact', head: true })
      .gte('protocol_date', `${year}-01-01`);
    return NextResponse.json({ number: nextProtocolNumber(year, count ?? 0) });
  } catch {
    return NextResponse.json({ number: nextProtocolNumber(year, 0) });
  }
}
