import { createServiceClient } from '@/lib/supabase/server';
import type { ParsedRow } from './types';

export interface ApplySummary {
  clients: number;
  sites: number;
  extinguishers: number;
  events: number;
}

/** Upsert на клиенти/обекти/гасители + начални service_events. Идемпотентно по (обект, сериен №). */
export async function applyImport(rows: ParsedRow[]): Promise<ApplySummary> {
  const db = createServiceClient();
  const summary: ApplySummary = { clients: 0, sites: 0, extinguishers: 0, events: 0 };

  const clientIds = new Map<string, string>();
  const siteIds = new Map<string, string>();
  const brandIds = new Map<string, string>();

  for (const r of rows) {
    // клиент (по име)
    let clientId = clientIds.get(r.client);
    if (!clientId) {
      const { data: existing } = await db.from('clients').select('id').eq('name', r.client).maybeSingle();
      if (existing?.id) {
        clientId = existing.id;
      } else {
        const { data: ins } = await db.from('clients').insert({ name: r.client }).select('id').single();
        clientId = ins!.id;
        summary.clients++;
      }
      clientIds.set(r.client, clientId!);
    }

    // обект (по име + клиент)
    const siteKey = `${clientId}|${r.site}`;
    let siteId = siteIds.get(siteKey);
    if (!siteId) {
      const { data: existing } = await db
        .from('sites').select('id').eq('client_id', clientId!).eq('name', r.site).maybeSingle();
      if (existing?.id) {
        siteId = existing.id;
      } else {
        const { data: ins } = await db.from('sites').insert({ client_id: clientId, name: r.site }).select('id').single();
        siteId = ins!.id;
        summary.sites++;
      }
      siteIds.set(siteKey, siteId!);
    }

    // марка (по име)
    let brandId: string | null = null;
    if (r.brand) {
      brandId = brandIds.get(r.brand) ?? null;
      if (!brandId) {
        const { data: existing } = await db.from('brands').select('id').eq('name', r.brand).maybeSingle();
        if (existing?.id) {
          brandId = existing.id;
        } else {
          const { data: ins } = await db.from('brands').insert({ name: r.brand }).select('id').single();
          brandId = ins!.id;
        }
        brandIds.set(r.brand, brandId!);
      }
    }

    // гасител (по обект + сериен №) — идемпотентно
    const { data: existingExt } = await db
      .from('extinguishers').select('id').eq('site_id', siteId!).eq('serial_number', r.serial).maybeSingle();
    let extId = existingExt?.id as string | undefined;
    const extPayload = {
      site_id: siteId,
      brand_id: brandId,
      model: r.model,
      type: r.type,
      serial_number: r.serial,
      manufacture_year: r.year,
      mass_kg: r.massKg,
      stamp_year: r.stampYear,
    };
    if (extId) {
      await db.from('extinguishers').update(extPayload).eq('id', extId);
    } else {
      const { data: ins } = await db.from('extinguishers').insert(extPayload).select('id').single();
      extId = ins!.id;
      summary.extinguishers++;
    }

    // начални събития (само ако още няма за този гасител)
    const { count } = await db
      .from('service_events').select('*', { count: 'exact', head: true }).eq('extinguisher_id', extId!);
    if (!count) {
      const evs: Array<{ extinguisher_id: string; kind: string; service_date: string; technician_name: string | null }> = [];
      if (r.lastTO) evs.push({ extinguisher_id: extId!, kind: 'TO', service_date: r.lastTO, technician_name: r.technician });
      if (r.lastRecharge) {
        const kind = r.type === 'foam' ? 'foam_change' : r.type.startsWith('powder') ? 'powder_change' : 'recharge';
        evs.push({ extinguisher_id: extId!, kind, service_date: r.lastRecharge, technician_name: r.technician });
      }
      if (r.lastHI) evs.push({ extinguisher_id: extId!, kind: 'HI', service_date: r.lastHI, technician_name: r.technician });
      if (evs.length) {
        await db.from('service_events').insert(evs);
        summary.events += evs.length;
      }
    }
  }
  return summary;
}
