import {
  getEnrichedExtinguishers,
  getExtinguisher,
  type EnrichedExt,
  type ExtinguisherDetail,
} from '@/lib/dashboard/queries';
import type { DueAction } from '@/lib/dashboard/status';

/** Търси пожарогасители по модел, сериен №, обект, клиент, категория (всички думи трябва да съвпадат). */
export async function searchExtinguishers(q: string): Promise<EnrichedExt[]> {
  const term = (q ?? '').trim().toLowerCase();
  if (!term) return [];
  const tokens = term.split(/\s+/).filter(Boolean);
  const all = await getEnrichedExtinguishers();
  return all.filter((e) => {
    const hay = [e.model, e.serial_number, e.siteName, e.clientName, e.category]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return tokens.every((t) => hay.includes(t));
  });
}

export interface DueFilter {
  site?: string;
  action?: DueAction;
  withinDays?: number;
}

/** Пожарогасители за обслужване (просрочени + предстоящи) с филтри по обект/действие/срок. */
export async function getDueExtinguishers(f: DueFilter = {}): Promise<EnrichedExt[]> {
  const within = f.withinDays ?? 30;
  const all = await getEnrichedExtinguishers();
  return all
    .filter((e) => e.status.level === 'overdue' || e.status.level === 'soon')
    .filter((e) => (e.status.daysUntil ?? Infinity) <= within)
    .filter((e) => (f.site ? e.siteName.toLowerCase().includes(f.site.toLowerCase()) : true))
    .filter((e) => (f.action ? e.status.dueAction === f.action : true))
    .sort((a, b) => (a.status.daysUntil ?? 0) - (b.status.daysUntil ?? 0));
}

export async function countScrapped(): Promise<number> {
  const all = await getEnrichedExtinguishers();
  return all.filter((e) => e.status.level === 'scrap').length;
}

/** Намира пожарогасител по сериен № (точно или съдържане) и връща детайла с история. */
export async function getDetailBySerial(serial: string): Promise<ExtinguisherDetail | null> {
  const s = (serial ?? '').trim().toLowerCase();
  if (!s) return null;
  const all = await getEnrichedExtinguishers();
  const exact = all.find((e) => (e.serial_number ?? '').toLowerCase() === s);
  const match = exact ?? all.find((e) => (e.serial_number ?? '').toLowerCase().includes(s));
  if (!match) return null;
  return getExtinguisher(match.id);
}
