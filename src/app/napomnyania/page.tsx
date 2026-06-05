import Link from 'next/link';
import { getEnrichedExtinguishers } from '@/lib/dashboard/queries';
import ReminderButton from '@/components/ReminderButton';

export const dynamic = 'force-dynamic';

const bg = (iso: string) => iso.split('-').reverse().join('.');

export default async function RemindersPage() {
  const all = await getEnrichedExtinguishers();
  const due = all
    .filter((e) => (e.status.level === 'overdue' || e.status.level === 'soon') && e.status.nextDue)
    .sort((a, b) => (a.status.daysUntil ?? 0) - (b.status.daysUntil ?? 0));

  return (
    <div className="wrap">
      <Link href="/" className="back">← Табло</Link>
      <div className="sec-h">
        <h2>Напомняния</h2>
        <div className="meta">{due.length}</div>
      </div>
      {due.length === 0 && <div className="hint">Няма предстоящи или просрочени падежи.</div>}
      {due.map((e) => (
        <div key={e.id} className={`ext ${e.status.level}`} style={{ display: 'block' }}>
          <div className="main">
            <div className="nm">
              {e.model ?? 'Пожарогасител'} № {e.serial_number}
            </div>
            <div className="meta">
              <span>
                {e.clientName} · {e.siteName}
              </span>
              <span className={`chip ${e.status.level === 'overdue' ? 'over' : e.status.level}`}>{e.status.label}</span>
              {e.status.nextDue && <span>срок {bg(e.status.nextDue)}</span>}
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <ReminderButton
              clientName={e.clientName}
              siteName={e.siteName}
              model={e.model}
              serial={e.serial_number}
              action={e.status.dueAction}
              nextDue={e.status.nextDue as string}
              overdue={e.status.level === 'overdue'}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
