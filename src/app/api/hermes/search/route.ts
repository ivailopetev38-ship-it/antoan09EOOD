import { NextRequest, NextResponse } from 'next/server';
import { requireHermesAuth } from '@/lib/hermes/auth';
import { searchExtinguishers } from '@/lib/hermes/data';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = requireHermesAuth(req);
  if (denied) return denied;

  const q = req.nextUrl.searchParams.get('q') ?? '';
  const results = await searchExtinguishers(q);
  return NextResponse.json({ count: results.length, results });
}
