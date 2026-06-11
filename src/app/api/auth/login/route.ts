import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE = 'app_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 дни

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Невалидни данни' }, { status: 400 });
  }

  const USER = process.env.APP_USER;
  const PASS = process.env.APP_PASSWORD;
  if (!USER || !PASS) {
    return NextResponse.json({ ok: false, error: 'Входът не е конфигуриран' }, { status: 500 });
  }

  if (!safeEq(body.username ?? '', USER) || !safeEq(body.password ?? '', PASS)) {
    return NextResponse.json({ ok: false, error: 'Грешен потребител или парола' }, { status: 401 });
  }

  const secret = process.env.AUTH_SECRET || PASS;
  const payload = String(Date.now() + MAX_AGE * 1000);
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, `${payload}.${sig}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  return res;
}
