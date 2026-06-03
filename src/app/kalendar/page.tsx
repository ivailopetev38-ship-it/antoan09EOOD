import Link from "next/link";
import { getSchedule, type ScheduleItem } from "@/lib/dashboard/queries";
import type { SuggestedAction } from "@/lib/regulatory/types";

export const dynamic = "force-dynamic";

const MONTHS = ["ЯНУАРИ", "ФЕВРУАРИ", "МАРТ", "АПРИЛ", "МАЙ", "ЮНИ", "ЮЛИ", "АВГУСТ", "СЕПТЕМВРИ", "ОКТОМВРИ", "НОЕМВРИ", "ДЕКЕМВРИ"];
const ACTION_LABEL: Record<SuggestedAction, string> = { TO: "ТО", recharge: "ПЗ", HI: "ХИ", scrap: "БРАК" };
const bg = (iso: string) => iso.split("-").reverse().join(".");

function rel(d: number): string {
  if (d < 0) return `просрочен с ${-d} дни`;
  if (d === 0) return "днес";
  if (d === 1) return "утре";
  return `до ${d} дни`;
}

function Item({ i }: { i: ScheduleItem }) {
  return (
    <Link href={`/pg/${i.id}`} className={`cal-item ${i.level}`}>
      <span className={`act ${i.action}`}>{ACTION_LABEL[i.action]}</span>
      <div className="ci-main">
        <div className="ci-nm">{i.model ?? "Пожарогасител"} · <span className="mono">№ {i.serialNumber}</span></div>
        <div className="ci-sub">{i.siteName}</div>
      </div>
      <div className="ci-due">
        <div className="d">{bg(i.nextDue)}</div>
        <div className="rel">{rel(i.daysUntil)}</div>
      </div>
    </Link>
  );
}

export default async function CalendarPage() {
  const { counts, items } = await getSchedule();
  const now = new Date();
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  const overdue = items.filter((i) => i.daysUntil < 0);
  const week = items.filter((i) => i.daysUntil >= 0 && i.daysUntil <= 7);
  const month = items.filter((i) => i.daysUntil > 7 && i.daysUntil <= 30);

  return (
    <div className="wrap">
      <Link href="/" className="back">← Табло</Link>

      <div className="cal-head">
        <div>
          <h2>📅 Календар на обслужванията</h2>
          <div className="cal-month">{monthLabel}</div>
        </div>
        <div className="cal-warn">⚠️ {items.length} за обслужване</div>
      </div>

      <div className="cal-types">
        <div className="cal-type TO"><div className="n">{counts.TO}</div><div className="t">Техническо · 1г</div></div>
        <div className="cal-type recharge"><div className="n">{counts.recharge}</div><div className="t">Презареждане · 2г</div></div>
        <div className="cal-type HI"><div className="n">{counts.HI}</div><div className="t">Хидростатично · 10г</div></div>
      </div>

      {overdue.length > 0 && (
        <>
          <div className="group-h over">🔴 Просрочени · {overdue.length}</div>
          {overdue.map((i) => <Item key={i.id} i={i} />)}
        </>
      )}
      {week.length > 0 && (
        <>
          <div className="group-h soon">🟡 Тази седмица · {week.length}</div>
          {week.map((i) => <Item key={i.id} i={i} />)}
        </>
      )}
      {month.length > 0 && (
        <>
          <div className="group-h">📌 До 30 дни · {month.length}</div>
          {month.map((i) => <Item key={i.id} i={i} />)}
        </>
      )}
      {items.length === 0 && <div className="hint">Няма предстоящи обслужвания. 🎉</div>}
    </div>
  );
}
