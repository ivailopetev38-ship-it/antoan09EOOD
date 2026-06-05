import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

/**
 * Защита за /api/hermes/* — изисква `Authorization: Bearer <HERMES_API_TOKEN>`.
 * Връща NextResponse при отказ, или null ако заявката е оторизирана.
 */
export function requireHermesAuth(req: NextRequest): NextResponse | null {
  const expected = process.env.HERMES_API_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'HERMES_API_TOKEN не е конфигуриран на сървъра' }, { status: 500 });
  }
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const provided = match?.[1]?.trim() ?? '';
  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json({ error: 'Неоторизиран' }, { status: 401 });
  }
  return null;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
