export interface ReminderItem {
  clientName: string;
  siteName: string;
  model: string | null;
  serial: string | null;
  action: 'TO' | 'recharge' | 'HI' | null;
  nextDue: string;
  overdue: boolean;
}

const ACTION: Record<'TO' | 'recharge' | 'HI', string> = {
  TO: 'техническо обслужване',
  recharge: 'презареждане',
  HI: 'хидростатично изпитване',
};

function bg(iso: string): string {
  return iso.split('-').reverse().join('.');
}

export function composeReminder(it: ReminderItem): string {
  const what = it.action ? ACTION[it.action] : 'обслужване';
  const dev = `${it.model ?? 'пожарогасител'}${it.serial ? ` № ${it.serial}` : ''}`;
  const head = it.overdue
    ? `Просрочено ${what} (от ${bg(it.nextDue)})`
    : `Предстои ${what} на ${bg(it.nextDue)}`;
  return `Уважаеми клиенти (${it.clientName}),\n${head} за ${dev} на обект „${it.siteName}".\nМоля, свържете се с нас за насрочване на сервиз. — АНТОАН-09`;
}
