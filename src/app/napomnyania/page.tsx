import Link from 'next/link';
import { getEnrichedExtinguishers } from '@/lib/dashboard/queries';
import { createServiceClient } from '@/lib/supabase/server';
import ReminderButton from '@/components/ReminderButton';

interface SchedRow { id: string; model: string | null; serial: string | null; client_name: string | null; site_name: string | null; due_date: string }

export const dynamic = 'force-dynamic';

const bg = (iso: string) => iso.split('-').reverse().join('.');

export default async function RemindersPage() {
  const all = await getEnrichedExtinguishers();
  const due = all
    .filter((e) => (e.status.level === 'overdue' || e.status.level === 'soon') && e.status.nextDue)
    .sort((a, b) => (a.status.daysUntil ?? 0) - (b.status.daysUntil ?? 0));

  const db = createServiceClient();
  const { data: schedRows } = await db.from('reminders').select('id, model, serial, client_name, site_name, due_date').eq('sent', false).order('due_date');
  const scheduled = (schedRows ?? []) as SchedRow[];

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

      <div className="sec-h" style={{ marginTop: 22 }}>
        <h2>📅 Насрочени напомняния</h2>
        <div className="meta">{scheduled.length}</div>
      </div>
      {scheduled.length === 0 && <div className="hint">Няма насрочени напомняния (насрочи от картата на гасител).</div>}
      {scheduled.map((r) => (
        <div key={r.id} className="ext soon" style={{ display: 'block' }}>
          <div className="main">
            <div className="nm">{r.model ?? 'Пожарогасител'}{r.serial ? ` № ${r.serial}` : ''}</div>
            <div className="meta">
              <span>{r.client_name ?? ''}{r.site_name ? ` · ${r.site_name}` : ''}</span>
              <span className="chip soon">напомняне на {bg(r.due_date)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
