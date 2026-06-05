import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getVisionProvider } from '@/lib/vision/provider';
import { stickerToEngineInput } from '@/lib/vision/map';
import { computeExtinguisherStatus } from '@/lib/regulatory/engine';
import { deriveStatus } from '@/lib/dashboard/status';
import type { RecognizeResult } from '@/lib/vision/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { imageBase64?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Невалиден JSON' }, { status: 400 });
  }
  if (!body.imageBase64) {
    return NextResponse.json({ ok: false, error: 'Липсва снимка' }, { status: 400 });
  }

  let rec: RecognizeResult;
  try {
    rec = await getVisionProvider().recognize(body.imageBase64);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Грешка при разпознаване: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const f = rec.fields;

  // Намери гасителя по сериен № (за реален статус + протокол)
  let match: { id: string; siteId: string; siteName: string } | null = null;
  if (f.serial) {
    const db = createServiceClient();
    const { data } = await db
      .from('extinguishers')
      .select('id, site_id, sites(name)')
      .ilike('serial_number', f.serial)
      .limit(1)
      .maybeSingle();
    if (data) {
      const site = (data as { sites?: { name?: string } | { name?: string }[] }).sites;
      const siteName = (Array.isArray(site) ? site[0]?.name : site?.name) ?? '';
      match = { id: data.id as string, siteId: data.site_id as string, siteName };
    }
  }

  // Статус от стикера (за показване дори без съвпадение)
  const inp = stickerToEngineInput(f, today);
  const status = inp ? deriveStatus(computeExtinguisherStatus(inp), today) : null;

  return NextResponse.json({ ok: true, demo: rec.demo, confidence: rec.confidence, fields: f, match, status });
}
