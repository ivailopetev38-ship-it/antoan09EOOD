import { NextRequest, NextResponse } from 'next/server';
import { requireHermesAuth } from '@/lib/hermes/auth';
import { answerQuery } from '@/lib/hermes/query';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = requireHermesAuth(req);
  if (denied) return denied;

  let body: { q?: string; text?: string; question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Невалиден JSON' }, { status: 400 });
  }
  const text = body?.q ?? body?.text ?? body?.question ?? '';
  const result = await answerQuery(text);
  return NextResponse.json(result);
}
