import { NextRequest, NextResponse } from 'next/server';

// Защитава целия сайт с един вход + парола (Basic Auth).
// Изключени: статиката и Hermes endpoint-ите (те са с Bearer токен, вика ги ботът).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/hermes).*)'],
};

export function middleware(req: NextRequest) {
  const USER = process.env.APP_USER;
  const PASS = process.env.APP_PASSWORD;

  // Ако креденшълите не са зададени → сайтът остава отворен (без заключване).
  if (!USER || !PASS) return NextResponse.next();

  const header = req.headers.get('authorization') || '';
  if (header.startsWith('Basic ')) {
    try {
      const [user, pass] = atob(header.slice(6)).split(':');
      if (user === USER && pass === PASS) return NextResponse.next();
    } catch {
      /* невалиден хедър → пада към 401 */
    }
  }

  return new NextResponse('Необходим е вход за достъп.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Антоан-09", charset="UTF-8"' },
  });
}
