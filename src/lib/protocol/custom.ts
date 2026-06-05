import { createServiceClient } from '@/lib/supabase/server';
import { generateProtocolDocx } from './generateDocx';
import { nextProtocolNumber } from './protocolNumber';
import type { ProtocolData } from './types';

/** Генерира протокол (.docx) от подадени данни. Ако няма номер — изчислява следващия пореден. */
export async function generateCustomProtocol(
  data: ProtocolData,
): Promise<{ buffer: Buffer; filename: string; protocolNo: string }> {
  let protocolNo = (data.protocolNo ?? '').trim();
  if (!protocolNo) {
    const today = new Date().toISOString().slice(0, 10);
    const year = Number(today.slice(0, 4));
    const db = createServiceClient();
    const { count } = await db
      .from('protocols')
      .select('*', { count: 'exact', head: true })
      .gte('protocol_date', `${year}-01-01`);
    protocolNo = nextProtocolNumber(year, count ?? 0);
  }
  const full: ProtocolData = { ...data, protocolNo };
  const buffer = generateProtocolDocx(full);
  return { buffer, filename: `protokol-${protocolNo.replace('/', '-')}.docx`, protocolNo };
}
