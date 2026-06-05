import { NextResponse } from 'next/server';
import { parseImport } from '@/lib/import/parse';
import { applyImport } from '@/lib/import/apply';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Невалиден JSON' }, { status: 400 });
  }
  const text = body.text ?? '';
  const { rows, errors } = parseImport(text);
  if (!rows.length) {
    return NextResponse.json({ ok: false, parsed: 0, errors }, { status: 400 });
  }
  const summary = await applyImport(rows);
  return NextResponse.json({ ok: true, parsed: rows.length, errors, summary });
}
