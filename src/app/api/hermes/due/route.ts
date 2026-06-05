import { NextRequest, NextResponse } from 'next/server';
import { requireHermesAuth } from '@/lib/hermes/auth';
import { getDueExtinguishers } from '@/lib/hermes/data';
import type { DueAction } from '@/lib/dashboard/status';

export const dynamic = 'force-dynamic';

const ACTIONS: Record<string, DueAction> = {
  TO: 'TO', recharge: 'recharge', HI: 'HI',
  ТО: 'TO', ПЗ: 'recharge', ХИ: 'HI',
};

export async function GET(req: NextRequest) {
  const denied = requireHermesAuth(req);
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const site = sp.get('site') ?? undefined;
  const actionParam = sp.get('action');
  const action = actionParam ? ACTIONS[actionParam] : undefined;
  const withinRaw = sp.get('withinDays');
  const withinNum = withinRaw ? Number(withinRaw) : undefined;
  const withinDays = withinNum != null && Number.isFinite(withinNum) ? withinNum : undefined;

  const results = await getDueExtinguishers({ site, action, withinDays });
  return NextResponse.json({ count: results.length, results });
}
