import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getVisionProvider } from '@/lib/vision/provider';
import { stickerToEngineInput } from '@/lib/vision/map';
import { computeExtinguisherStatus } from '@/lib/regulatory/engine';
import { deriveStatus } from '@/lib/dashboard/status';
import { parseRawSticker, mergeStickerFields } from '@/lib/vision/parseRaw';
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
  // Предпочита чистия локален парсер на суровия текст; полетата от Hermes допълват липсите.
  const f = mergeStickerFields(parseRawSticker(rec.raw ?? ''), rec.fields);

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
        brand: string | null;
        model: string | null;
        type: string | null;
        serial: string | null;
        year: number | null;
      }
    | null = null;
  if (f.serial) {
    const db = createServiceClient();
    const SELECT =
      'id, site_id, model, type, serial_number, manufacture_year, category, mass_kg, brands(name), sites(name, address, clients(name, address, phone))';
    const exact = await db.from('extinguishers').select(SELECT).ilike('serial_number', f.serial).limit(1).maybeSingle();
    let data = exact.data;
    if (!data) {
      // Толерантно съвпадение: ако точното пропадне (OCR е разместил тире/интервал),
      // сравняваме нормализирано (без не-буквено-цифрови) и приемаме само при ЕДИН кандидат.
      const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
      const target = norm(f.serial);
      if (target.length >= 4) {
        const list = await db.from('extinguishers').select('id, serial_number');
        const cands = ((list.data ?? []) as Array<{ id: string; serial_number: string | null }>).filter((r) => {
          const n = norm(r.serial_number ?? '');
          return n.length >= 4 && (n.includes(target) || target.includes(n));
        });
        if (cands.length === 1) {
          const full = await db.from('extinguishers').select(SELECT).eq('id', cands[0].id).maybeSingle();
          data = full.data;
        }
      }
    }
    if (data) {
      const d = data as {
        id: string;
        site_id: string;
        model: string | null;
        type: string | null;
        serial_number: string | null;
        manufacture_year: number | null;
        category: string | null;
        mass_kg: number | null;
        brands?: { name?: string } | { name?: string }[] | null;
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
      const br = Array.isArray(d.brands) ? d.brands[0] : d.brands;
      match = {
        id: d.id,
        siteId: d.site_id,
        siteName: site?.name ?? '',
        ownerName: cl?.name ?? '',
        ownerAddress: cl?.address ?? '',
        ownerPhone: cl?.phone ?? '',
        category: d.category,
        mass: d.mass_kg,
        brand: br?.name ?? null,
        model: d.model,
        type: d.type,
        serial: d.serial_number,
        year: d.manufacture_year,
      };
    }
  }

  // Статус от стикера (за показване дори без съвпадение)
  const inp = stickerToEngineInput(f, today);
  const status = inp ? deriveStatus(computeExtinguisherStatus(inp), today) : null;

  return NextResponse.json({ ok: true, demo: rec.demo, confidence: rec.confidence, fields: f, match, status });
}
