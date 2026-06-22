import { createServiceClient } from '@/lib/supabase/server';
import { computeExtinguisherStatus } from '@/lib/regulatory/engine';
import { deriveCategory } from '@/lib/regulatory/category';
import type { ExtinguisherType } from '@/lib/regulatory/types';
import type { LineDraft } from './draft';

export interface SiteDrafts {
  ok: boolean;
  status: number;
  error?: string;
  ownerName: string;
  ownerAddress: string;
  ownerPhone: string;
  ownerEmail: string;
  siteId: string;
  lines: LineDraft[];
}

type ExtRow = {
  id: string; model: string | null; type: string; serial_number: string | null;
  manufacture_year: number | null; stamp_year: number | null; category: string | null;
  mass_kg: number | null; gross_mass_kg: number | null;
  brands?: { name?: string } | { name?: string }[] | null;
};

/**
 * Чете обект + клиент + (небракувани) гасители и ги връща като редактируеми редове за кошницата.
 * Действието по подразбиране = предложеното от нормативния двигател. Споделя се между
 * автоматичния обектен протокол (build.ts) и „Зареди от обект" в сканиращата форма.
 */
export async function getSiteDrafts(siteId: string): Promise<SiteDrafts> {
  const empty = { ownerName: '', ownerAddress: '', ownerPhone: '', ownerEmail: '', siteId, lines: [] as LineDraft[] };
  const db = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: site, error: siteErr } = await db
    .from('sites').select('id,name,address,clients(name,address,phone,email)').eq('id', siteId).single();
  if (siteErr || !site) return { ok: false, status: 404, error: 'Обектът не е намерен', ...empty };

  const { data: exts, error: extErr } = await db
    .from('extinguishers').select('*, brands(name)').eq('site_id', siteId).order('created_at');
  if (extErr) return { ok: false, status: 500, error: 'Грешка при четене на гасители', ...empty };

  const list = (exts ?? []) as ExtRow[];
  const ids = list.map((e) => e.id);
  const history: Record<string, { lastTO: string | null; lastRecharge: string | null; lastHI: string | null }> = {};
  if (ids.length) {
    const { data: events } = await db
      .from('service_events').select('extinguisher_id,kind,service_date').in('extinguisher_id', ids);
    for (const ev of (events ?? []) as Array<{ extinguisher_id: string; kind: string; service_date: string }>) {
      const h = (history[ev.extinguisher_id] ??= { lastTO: null, lastRecharge: null, lastHI: null });
      const d = ev.service_date;
      if (ev.kind === 'TO') { if (!h.lastTO || d > h.lastTO) h.lastTO = d; }
      else if (ev.kind === 'HI') { if (!h.lastHI || d > h.lastHI) h.lastHI = d; }
      else if (ev.kind === 'recharge' || ev.kind === 'powder_change' || ev.kind === 'foam_change') { if (!h.lastRecharge || d > h.lastRecharge) h.lastRecharge = d; }
    }
  }

  const lines: LineDraft[] = [];
  for (const e of list) {
    const h = history[e.id] ?? { lastTO: null, lastRecharge: null, lastHI: null };
    const status = computeExtinguisherStatus({
      type: e.type as ExtinguisherType, manufactureYear: e.manufacture_year ?? 0, stampYear: e.stamp_year,
      lastTO: h.lastTO, lastRecharge: h.lastRecharge, lastHI: h.lastHI, today,
    });
    if (status.isScrapped) continue; // бракуваните не влизат в протокол за предаване
    const sa = status.suggestedAction;
    const action = sa === 'recharge' || sa === 'HI' ? sa : 'TO';
    const br = Array.isArray(e.brands) ? e.brands[0] : e.brands;
    lines.push({
      id: e.id,
      brand: br?.name ?? '',
      model: e.model ?? '',
      serial: e.serial_number ?? '',
      year: e.manufacture_year != null ? String(e.manufacture_year) : '',
      type: e.type ?? 'powder_abc',
      cap: e.mass_kg != null ? String(e.mass_kg) : '',
      category: e.category ?? deriveCategory(e.type as ExtinguisherType),
      totalMass: e.gross_mass_kg != null ? String(e.gross_mass_kg) : '',
      action,
      agentTrade: '',
      date: today,
      sticker: '',
      tech: 'Х. Христов',
    });
  }

  const clientRaw = (site as unknown as { clients?: unknown }).clients;
  const client = (Array.isArray(clientRaw) ? clientRaw[0] : clientRaw) as
    | { name?: string; address?: string; phone?: string; email?: string } | undefined;
  const siteAddr = (site as unknown as { address?: string }).address;
  return {
    ok: true, status: 200,
    ownerName: client?.name ?? '',
    ownerAddress: client?.address ?? siteAddr ?? '',
    ownerPhone: client?.phone ?? '',
    ownerEmail: client?.email ?? '',
    siteId,
    lines,
  };
}
