import type { EngineResult } from '@/lib/regulatory/types';

export type StatusLevel = 'ok' | 'soon' | 'overdue' | 'scrap';
export type DueAction = 'TO' | 'recharge' | 'HI';

export interface UiStatus {
  level: StatusLevel;
  nextDue: string | null; // ISO
  daysUntil: number | null;
  label: string;
  dueAction: DueAction | null;
}

const DAY = 86_400_000;

/** Извежда UI статус (зелено/жълто/червено/БРАК) от изхода на нормативния двигател. */
export function deriveStatus(r: EngineResult, today: string): UiStatus {
  if (r.isScrapped) {
    return { level: 'scrap', nextDue: null, daysUntil: null, label: 'БРАК', dueAction: null };
  }

  const candidates: Array<{ action: DueAction; date: string }> = [];
  if (r.dueDates.to) candidates.push({ action: 'TO', date: r.dueDates.to });
  if (r.dueDates.rechargeOrChange) candidates.push({ action: 'recharge', date: r.dueDates.rechargeOrChange });
  if (r.dueDates.hi) candidates.push({ action: 'HI', date: r.dueDates.hi });
  candidates.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const first = candidates[0];
  if (!first) return { level: 'ok', nextDue: null, daysUntil: null, label: 'ОК', dueAction: null };

  const t = new Date(today + 'T00:00:00Z').getTime();
  const n = new Date(first.date + 'T00:00:00Z').getTime();
  const days = Math.round((n - t) / DAY);

  if (days < 0) return { level: 'overdue', nextDue: first.date, daysUntil: days, label: 'Просрочен', dueAction: first.action };
  if (days <= 30) return { level: 'soon', nextDue: first.date, daysUntil: days, label: `До ${days} дни`, dueAction: first.action };
  const months = Math.max(1, Math.round(days / 30));
  return { level: 'ok', nextDue: first.date, daysUntil: days, label: `ОК · ${months}м`, dueAction: first.action };
}
