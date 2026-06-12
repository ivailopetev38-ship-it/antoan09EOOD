import type { SupabaseClient } from '@supabase/supabase-js';

export interface FindOrCreateSiteInput {
  clientName: string;
  siteName: string;
  address?: string | null;
  phone?: string | null;
}
export interface FindOrCreateSiteResult {
  siteId: string;
  createdClient: boolean;
  createdSite: boolean;
}

/** Намира клиент по име (или го създава) и обект по (клиент+име) (или го създава). Идемпотентно. */
export async function findOrCreateSite(
  db: SupabaseClient,
  input: FindOrCreateSiteInput,
): Promise<FindOrCreateSiteResult> {
  const clientName = (input.clientName ?? '').trim();
  const siteName = (input.siteName ?? '').trim();
  if (!clientName || !siteName) throw new Error('Липсва име на клиент или обект');
  const address = input.address?.trim() || null;
  const phone = input.phone?.trim() || null;

  let createdClient = false;
  const { data: c } = await db.from('clients').select('id').eq('name', clientName).maybeSingle();
  let clientId = (c as { id?: string } | null)?.id;
  if (!clientId) {
    const ins = await db.from('clients').insert({ name: clientName, address, phone }).select('id').single();
    clientId = (ins.data as { id: string }).id;
    createdClient = true;
  }

  let createdSite = false;
  const { data: s } = await db.from('sites').select('id').eq('client_id', clientId).eq('name', siteName).maybeSingle();
  let siteId = (s as { id?: string } | null)?.id;
  if (!siteId) {
    const ins = await db.from('sites').insert({ client_id: clientId, name: siteName, address }).select('id').single();
    siteId = (ins.data as { id: string }).id;
    createdSite = true;
  }

  return { siteId: siteId!, createdClient, createdSite };
}
