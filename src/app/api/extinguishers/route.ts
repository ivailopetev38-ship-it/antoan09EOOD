import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const TYPES = ['powder_abc', 'powder_bc', 'water', 'foam', 'co2'];

export async function POST(req: Request) {
  let b: {
    siteId?: string;
    type?: string;
    model?: string;
    serialNumber?: string;
    manufactureYear?: number;
    massKg?: number;
    stampYear?: number;
    category?: string;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Невалиден JSON' }, { status: 400 });
  }
  if (!b.siteId || !b.type || !b.serialNumber || !b.manufactureYear) {
    return NextResponse.json({ ok: false, error: 'Липсват задължителни полета' }, { status: 400 });
  }
  if (!TYPES.includes(b.type)) {
    return NextResponse.json({ ok: false, error: 'Невалиден тип' }, { status: 400 });
  }
  const db = createServiceClient();
  const { data, error } = await db
    .from('extinguishers')
    .insert({
      site_id: b.siteId,
      type: b.type,
      model: b.model || null,
      serial_number: b.serialNumber,
      manufacture_year: b.manufactureYear,
      mass_kg: b.massKg ?? null,
      stamp_year: b.stampYear ?? null,
      category: b.category || null,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data!.id });
}
