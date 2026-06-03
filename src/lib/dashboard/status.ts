import type { EngineResult } from '@/lib/regulatory/types';

export type StatusLevel = 'ok' | 'soon' | 'overdue' | 'scrap';

export interface UiStatus {
  level: StatusLevel;
  nextDue: string | null; // ISO
  daysUntil: number | null;
  label: string;
}

const DAY = 86_400_000;

/** Извежда UI статус (зелено/жълто/червено/БРАК) от изхода на нормативния двигател. */
export function deriveStatus(r: EngineResult, today: string): UiStatus {
  if (r.isScrapped) {
    return { level: 'scrap', nextDue: null, daysUntil: null, label: 'БРАК' };
  }
  const dates = [r.dueDates.to, r.dueDates.rechargeOrChange, r.dueDates.hi]
    .filter((d): d is string => d !== null)
    .sort();
  const next = dates[0] ?? null;
  if (!next) return { level: 'ok', nextDue: null, daysUntil: null, label: 'ОК' };

  const t = new Date(today + 'T00:00:00Z').getTime();
  const n = new Date(next + 'T00:00:00Z').getTime();
  const days = Math.round((n - t) / DAY);

  if (days < 0) return { level: 'overdue', nextDue: next, daysUntil: days, label: 'Просрочен' };
  if (days <= 30) return { level: 'soon', nextDue: next, daysUntil: days, label: `До ${days} дни` };
  const months = Math.max(1, Math.round(days / 30));
  return { level: 'ok', nextDue: next, daysUntil: days, label: `ОК · ${months}м` };
}
