import { createServiceClient } from '@/lib/supabase/server';
import { computeExtinguisherStatus } from '@/lib/regulatory/engine';
import type { ExtinguisherType } from '@/lib/regulatory/types';
import { deriveStatus, type UiStatus, type StatusLevel } from './status';

interface ExtRow {
  id: string;
  site_id: string;
  model: string | null;
  serial_number: string | null;
  type: ExtinguisherType;
  manufacture_year: number;
  category: string | null;
  mass_kg: number | null;
  stamp_year: number | null;
}

interface EventRow {
  extinguisher_id: string;
  kind: string;
  service_date: string;
}

interface History {
  lastTO: string | null;
  lastRecharge: string | null;
  lastHI: string | null;
}

export interface ExtWithStatus extends ExtRow {
  status: UiStatus;
}

export interface SiteSummary {
  id: string;
  name: string;
  address: string | null;
  clientName: string;
  total: number;
  overdue: number;
  soon: number;
  scrap: number;
  ok: number;
}

export interface Overview {
  kpis: Record<StatusLevel | 'total', number>;
  sites: SiteSummary[];
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function aggregate(events: EventRow[]): Record<string, History> {
  const h: Record<string, History> = {};
  for (const ev of events) {
    const e = (h[ev.extinguisher_id] ??= { lastTO: null, lastRecharge: null, lastHI: null });
    const d = ev.service_date;
    if (ev.kind === 'TO') {
      if (!e.lastTO || d > e.lastTO) e.lastTO = d;
    } else if (ev.kind === 'HI') {
      if (!e.lastHI || d > e.lastHI) e.lastHI = d;
    } else if (ev.kind === 'recharge' || ev.kind === 'powder_change' || ev.kind === 'foam_change') {
      if (!e.lastRecharge || d > e.lastRecharge) e.lastRecharge = d;
    }
  }
  return h;
}

function statusFor(e: ExtRow, h: History, day: string): UiStatus {
  const res = computeExtinguisherStatus({
    type: e.type,
    manufactureYear: e.manufacture_year,
    stampYear: e.stamp_year,
    lastTO: h.lastTO,
    lastRecharge: h.lastRecharge,
    lastHI: h.lastHI,
    today: day,
  });
  return deriveStatus(res, day);
}

async function allWithStatus(): Promise<ExtWithStatus[]> {
  const supabase = createServiceClient();
  const day = today();
  const { data: exts } = await supabase.from('extinguishers').select('*');
  const rows = (exts ?? []) as ExtRow[];
  const ids = rows.map((e) => e.id);

  let events: EventRow[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from('service_events')
      .select('extinguisher_id,kind,service_date')
      .in('extinguisher_id', ids);
    events = (data ?? []) as EventRow[];
  }
  const hist = aggregate(events);
  const empty: History = { lastTO: null, lastRecharge: null, lastHI: null };
  return rows.map((e) => ({ ...e, status: statusFor(e, hist[e.id] ?? empty, day) }));
}

export async function getOverview(): Promise<Overview> {
  const supabase = createServiceClient();
  const [sitesRes, all] = await Promise.all([
    supabase.from('sites').select('id,name,address,clients(name)'),
    allWithStatus(),
  ]);

  const sites = (sitesRes.data ?? []) as Array<{
    id: string;
    name: string;
    address: string | null;
    clients: { name: string } | { name: string }[] | null;
  }>;

  const count = (level: StatusLevel) => all.filter((e) => e.status.level === level).length;
  const kpis = {
    total: all.length,
    ok: count('ok'),
    soon: count('soon'),
    overdue: count('overdue'),
    scrap: count('scrap'),
  };

  const summaries: SiteSummary[] = sites.map((s) => {
    const es = all.filter((e) => e.site_id === s.id);
    const cl = Array.isArray(s.clients) ? s.clients[0] : s.clients;
    const c = (lvl: StatusLevel) => es.filter((e) => e.status.level === lvl).length;
    return {
      id: s.id,
      name: s.name,
      address: s.address,
      clientName: cl?.name ?? '',
      total: es.length,
      overdue: c('overdue'),
      soon: c('soon'),
      scrap: c('scrap'),
      ok: c('ok'),
    };
  });
  summaries.sort((a, b) => b.overdue + b.scrap - (a.overdue + a.scrap) || b.total - a.total);

  return { kpis, sites: summaries };
}

export interface SiteDetail {
  site: { id: string; name: string; address: string | null };
  client: { name: string; address: string | null; phone: string | null } | null;
  extinguishers: ExtWithStatus[];
}

export async function getSite(siteId: string): Promise<SiteDetail | null> {
  const supabase = createServiceClient();
  const { data: site } = await supabase
    .from('sites')
    .select('id,name,address,clients(name,address,phone)')
    .eq('id', siteId)
    .single();
  if (!site) return null;

  const all = await allWithStatus();
  const extinguishers = all
    .filter((e) => e.site_id === siteId)
    .sort((a, b) => {
      const order: Record<StatusLevel, number> = { scrap: 0, overdue: 1, soon: 2, ok: 3 };
      return order[a.status.level] - order[b.status.level];
    });

  const s = site as unknown as {
    id: string;
    name: string;
    address: string | null;
    clients: { name: string; address: string | null; phone: string | null } | { name: string; address: string | null; phone: string | null }[] | null;
  };
  const cl = Array.isArray(s.clients) ? s.clients[0] : s.clients;
  return { site: { id: s.id, name: s.name, address: s.address }, client: cl ?? null, extinguishers };
}

export interface ServiceEvent {
  kind: string;
  service_date: string;
  technician_name: string | null;
}

export interface ExtinguisherDetail {
  ext: ExtWithStatus;
  site: { id: string; name: string; address: string | null };
  client: { name: string; phone: string | null } | null;
  history: ServiceEvent[];
}

export async function getExtinguisher(id: string): Promise<ExtinguisherDetail | null> {
  const supabase = createServiceClient();
  const day = today();
  const { data } = await supabase
    .from('extinguishers')
    .select('*, sites(id,name,address,clients(name,phone))')
    .eq('id', id)
    .single();
  if (!data) return null;

  const { data: evRows } = await supabase
    .from('service_events')
    .select('extinguisher_id,kind,service_date,technician_name')
    .eq('extinguisher_id', id)
    .order('service_date', { ascending: false });
  const events = (evRows ?? []) as Array<EventRow & { technician_name: string | null }>;

  const hist = aggregate(events);
  const empty: History = { lastTO: null, lastRecharge: null, lastHI: null };

  const row = data as unknown as ExtRow & {
    sites: {
      id: string;
      name: string;
      address: string | null;
      clients: { name: string; phone: string | null } | { name: string; phone: string | null }[] | null;
    } | null;
  };
  const status = statusFor(row, hist[id] ?? empty, day);
  const site = row.sites;
  const clientRaw = site?.clients ?? null;
  const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw;

  return {
    ext: {
      id: row.id,
      site_id: row.site_id,
      model: row.model,
      serial_number: row.serial_number,
      type: row.type,
      manufacture_year: row.manufacture_year,
      category: row.category,
      mass_kg: row.mass_kg,
      stamp_year: row.stamp_year,
      status,
    },
    site: { id: site?.id ?? '', name: site?.name ?? '', address: site?.address ?? null },
    client: client ? { name: client.name, phone: client.phone ?? null } : null,
    history: events.map((e) => ({ kind: e.kind, service_date: e.service_date, technician_name: e.technician_name })),
  };
}
