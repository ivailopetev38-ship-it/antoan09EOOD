import { NextRequest, NextResponse } from 'next/server';

// Заключва целия сайт зад портал за вход (сесийна бисквитка с подписан токен).
// Изключени: статиката + Hermes endpoint-ите (Bearer токен, вика ги ботът).
// Самият портал (/login) и auth API-то (/api/auth/*) са публични (ранен return).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/hermes).*)'],
};

const COOKIE = 'app_session';

function safeEq(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function validCookie(value: string, secret: string): Promise<boolean> {
  const dot = value.lastIndexOf('.');
  if (dot < 0) return false;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const exp = Number(payload);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return safeEq(sig, await hmacHex(secret, payload));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Публични пътища: порталът, auth API-то и крон-маршрутът за напомняния
  // (последният се пази със собствена тайна / x-vercel-cron хедър в самия route).
  if (pathname === '/login' || pathname.startsWith('/api/auth/') || pathname === '/api/reminders/run') {
    return NextResponse.next();
  }

  const USER = process.env.APP_USER;
  const PASS = process.env.APP_PASSWORD;
  // Ако креденшълите липсват → сайтът остава отворен (без заключване).
  if (!USER || !PASS) return NextResponse.next();

  const secret = process.env.AUTH_SECRET || PASS;

  // 1) Валидна сесийна бисквитка (от портала)?
  const cookie = req.cookies.get(COOKIE)?.value;
  if (cookie && (await validCookie(cookie, secret))) return NextResponse.next();

  // 2) Валиден Basic header (за ботове/автоматизация)?
  const header = req.headers.get('authorization') || '';
  if (header.startsWith('Basic ')) {
    try {
      const [u, p] = atob(header.slice(6)).split(':');
      if (safeEq(u ?? '', USER) && safeEq(p ?? '', PASS)) return NextResponse.next();
    } catch {
      /* невалиден хедър */
    }
  }

  // 3) Неоторизиран: API → 401 JSON; страница → пренасочване към портала.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'Необходим е вход' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}
