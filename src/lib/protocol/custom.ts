import { createServiceClient } from '@/lib/supabase/server';
import { generateProtocolDocx } from './generateDocx';
import { nextProtocolNumber } from './protocolNumber';
import { parseFlexDate } from '@/lib/import/normalize';
import type { ProtocolData } from './types';

/** Генерира протокол (.docx) от подадени данни. Ако няма номер — изчислява следващия пореден
 *  и записва издадения протокол (за да върви броячът + да има дневник). */
export async function generateCustomProtocol(
  data: ProtocolData,
): Promise<{ buffer: Buffer; filename: string; protocolNo: string }> {
  const db = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));

  let protocolNo = (data.protocolNo ?? '').trim();
  if (!protocolNo) {
    const { count } = await db
      .from('protocols')
      .select('*', { count: 'exact', head: true })
      .gte('protocol_date', `${year}-01-01`);
    protocolNo = nextProtocolNumber(year, count ?? 0);
  }

  // Записваме издадения протокол (best-effort): така следващият номер е пореден + пазим дневник.
  if (data.siteId) {
    try {
      await db.from('protocols').insert({
        number: protocolNo,
        protocol_date: parseFlexDate(data.date) ?? today,
        city: data.city || undefined,
        site_id: data.siteId,
      });
    } catch {
      /* не чупим генерирането, ако записът се провали */
    }
  }

  const full: ProtocolData = { ...data, protocolNo };
  const buffer = generateProtocolDocx(full);
  return { buffer, filename: `protokol-${protocolNo.replace('/', '-')}.docx`, protocolNo };
}
