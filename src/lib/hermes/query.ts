import {
  searchExtinguishers,
  getDueExtinguishers,
  countScrapped,
  getDetailBySerial,
  type DueFilter,
} from './data';
import type { EnrichedExt } from '@/lib/dashboard/queries';
import type { DueAction } from '@/lib/dashboard/status';

export type Intent = 'due' | 'history' | 'count_scrap' | 'search';

// ---- чисти helper-и (тестваеми) ----

export function classifyIntent(text: string): Intent {
  const t = text.toLowerCase();
  if (/брак/.test(t)) return 'count_scrap';
  if (/истори/.test(t)) return 'history';
  if (
    /до\s+\d+\s*дн/.test(t) ||
    /за\s+(то|пз|хи|обслужван|презареж|хидростат)/.test(t) ||
    /(кои|които|какво)\b.*обект/.test(t) ||
    /предсто/.test(t)
  ) {
    return 'due';
  }
  return 'search';
}

export function parseAction(text: string): DueAction | undefined {
  // NB: JS \b не работи с кирилица → ползваме интервал/пунктуация като граница.
  const t = ` ${text.toLowerCase()} `;
  if (/хидростат|[\s.,?!]хи[\s.,?!]/.test(t)) return 'HI';
  if (/презареж|[\s.,?!]пз[\s.,?!]/.test(t)) return 'recharge';
  if (/техническ|[\s.,?!]то[\s.,?!]/.test(t)) return 'TO';
  return undefined;
}

export function parseWithinDays(text: string): number | undefined {
  const m = /(\d{1,4})\s*дн/i.exec(text);
  return m ? Number(m[1]) : undefined;
}

export function parseSite(text: string): string | undefined {
  const m = /обект[а]?\s+(.+?)(?=\s+(?:са|е|за)\s|[?.,!]|$)/i.exec(text);
  return m ? m[1].trim() : undefined;
}

export function extractSerial(text: string): string | undefined {
  const m = /сериен(?:\s+(?:номер|№))?\s+([A-Za-zА-Яа-я0-9-]+)/i.exec(text);
  if (m) return m[1];
  const tok = text.split(/[\s?.,!]+/).find((t) => /\d/.test(t) && t.length >= 2);
  return tok;
}

// ---- форматиране ----

const KIND: Record<string, string> = {
  TO: 'ТО', recharge: 'Презареждане', powder_change: 'Смяна на прах', foam_change: 'Смяна на пяна', HI: 'ХИ',
};
const ACT: Record<DueAction, string> = { TO: 'ТО', recharge: 'ПЗ', HI: 'ХИ' };
function bg(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
function fmtExt(e: EnrichedExt): string {
  return `${e.model ?? 'Пожарогасител'} № ${e.serial_number ?? '—'} — ${e.siteName} (${e.status.label})`;
}

// ---- основен dispatcher ----

export interface QueryResult {
  intent: Intent;
  answer: string;
  data?: unknown;
}

export async function answerQuery(rawText: string): Promise<QueryResult> {
  const text = (rawText ?? '').trim();
  if (!text) return { intent: 'search', answer: 'Моля, въведи въпрос или сериен номер.' };

  const intent = classifyIntent(text);

  if (intent === 'count_scrap') {
    const n = await countScrapped();
    return { intent, answer: `🛑 За брак: ${n} ${n === 1 ? 'пожарогасител' : 'пожарогасителя'}.`, data: { count: n } };
  }

  if (intent === 'history') {
    const serial = extractSerial(text);
    if (!serial) return { intent, answer: 'Не разпознах сериен номер. Пример: „история на сериен 5487".' };
    const d = await getDetailBySerial(serial);
    if (!d) return { intent, answer: `Няма намерен пожарогасител със сериен № ${serial}.` };
    const hist = d.history.length
      ? d.history.map((h) => `• ${bg(h.service_date)} — ${KIND[h.kind] ?? h.kind}${h.technician_name ? ` (${h.technician_name})` : ''}`).join('\n')
      : 'няма записани обслужвания';
    const e = d.ext;
    return {
      intent,
      answer: `🧯 ${e.model ?? ''} № ${e.serial_number} / ${e.manufacture_year} — ${d.site.name}\nСтатус: ${e.status.label}\nИстория:\n${hist}`,
      data: d,
    };
  }

  if (intent === 'due') {
    const filter: DueFilter = {
      action: parseAction(text),
      site: parseSite(text),
      withinDays: parseWithinDays(text),
    };
    const items = await getDueExtinguishers(filter);
    const head = `🔧 ${items.length} за обслужване${filter.site ? ` · ${filter.site}` : ''}${filter.action ? ` · ${ACT[filter.action]}` : ''}${filter.withinDays ? ` · до ${filter.withinDays} дни` : ''}`;
    const body = items.slice(0, 20).map((e) => `• ${fmtExt(e)}`).join('\n');
    return { intent, answer: items.length ? `${head}\n${body}` : head, data: items };
  }

  const results = await searchExtinguishers(text);
  if (!results.length) return { intent: 'search', answer: `Няма резултати за „${text}".` };
  const body = results.slice(0, 20).map((e) => `• ${fmtExt(e)}`).join('\n');
  return { intent: 'search', answer: `🔎 ${results.length} резултата:\n${body}`, data: results };
}
