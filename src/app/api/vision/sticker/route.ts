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

  // Намери гасителя по сериен № (за реален статус + попълване на протокола)
  let match:
    | {
        id: string;
        siteId: string;
        siteName: string;
        ownerName: string;
        ownerAddress: string;
        ownerPhone: string;
        category: string | null;
        mass: number | null;
      }
    | null = null;
  if (f.serial) {
    const db = createServiceClient();
    const { data } = await db
      .from('extinguishers')
      .select('id, site_id, category, mass_kg, sites(name, address, clients(name, address, phone))')
      .ilike('serial_number', f.serial)
      .limit(1)
      .maybeSingle();
    if (data) {
      const d = data as {
        id: string;
        site_id: string;
        category: string | null;
        mass_kg: number | null;
        sites?:
          | { name?: string; address?: string; clients?: unknown }
          | { name?: string; address?: string; clients?: unknown }[]
          | null;
      };
      const site = Array.isArray(d.sites) ? d.sites[0] : d.sites;
      const clRaw = (site as { clients?: unknown } | undefined)?.clients;
      const cl = (Array.isArray(clRaw) ? clRaw[0] : clRaw) as
        | { name?: string; address?: string; phone?: string }
        | undefined;
      match = {
        id: d.id,
        siteId: d.site_id,
        siteName: site?.name ?? '',
        ownerName: cl?.name ?? '',
        ownerAddress: cl?.address ?? '',
        ownerPhone: cl?.phone ?? '',
        category: d.category,
        mass: d.mass_kg,
      };
    }
  }

  // Статус от стикера (за показване дори без съвпадение)
  const inp = stickerToEngineInput(f, today);
  const status = inp ? deriveStatus(computeExtinguisherStatus(inp), today) : null;

  return NextResponse.json({ ok: true, demo: rec.demo, confidence: rec.confidence, fields: f, match, status });
}
