import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { getOverview } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

const DAYS = ["неделя", "понеделник", "вторник", "сряда", "четвъртък", "петък", "събота"];
const MONTHS = ["януари", "февруари", "март", "април", "май", "юни", "юли", "август", "септември", "октомври", "ноември", "декември"];

function greet(h: number) {
  if (h < 12) return "Добро утро";
  if (h < 18) return "Добър ден";
  return "Добра вечер";
}

export default async function Dashboard() {
  const { kpis, sites } = await getOverview();
  const now = new Date();
  const dateStr = `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="wrap">
      <header className="topbar">
        <div className="brand">
          <div className="mark">🧯</div>
          <div>
            <h1>Антоан-09</h1>
            <div className="sub">Система за сервиз на пожарогасители</div>
          </div>
        </div>
        <div className="top-right">
          <Link href="/kalendar" className="nav-link">📅 Календар</Link>
          <Link href="/napomnyania" className="nav-link">🔔 Напомняния</Link>
          <Link href="/qr" className="nav-link">🏷️ QR етикети</Link>
          <Link href="/skan" className="nav-scan">📷 Сканирай</Link>
          <LogoutButton />
          <div className="greet">
            <div className="hi">{greet(now.getHours())}, управител</div>
            <div className="date">{dateStr}</div>
          </div>
        </div>
      </header>

      <div className="kpi-grid">
        <div className="kpi fire"><div className="num">{kpis.total}</div><div className="lbl">Пожарогасители</div></div>
        <div className="kpi over"><div className="num">{kpis.overdue}</div><div className="lbl">Просрочени</div></div>
        <div className="kpi soon"><div className="num">{kpis.soon}</div><div className="lbl">За скоро · 30 дни</div></div>
        <div className="kpi scrap"><div className="num">{kpis.scrap}</div><div className="lbl">За брак</div></div>
        <div className="kpi ok"><div className="num">{kpis.ok}</div><div className="lbl">Изправни</div></div>
      </div>

      <div className="sec-h"><h2>Обекти</h2><div className="meta">{sites.length} обекта</div></div>
      <div className="site-grid">
        {sites.map((s) => {
          const segs: Array<[string, number]> = [
            ["seg-over", s.overdue],
            ["seg-scrap", s.scrap],
            ["seg-soon", s.soon],
            ["seg-ok", s.ok],
          ];
          const clean = s.overdue === 0 && s.scrap === 0 && s.soon === 0;
          return (
            <Link key={s.id} href={`/obekt/${s.id}`} className="site-card">
              <div className="nm">{s.name}</div>
              <div className="cl">{s.clientName}{s.address ? ` · ${s.address}` : ""}</div>
              <div className="bar">
                {segs.map(([cls, n]) => (n > 0 ? <span key={cls} className={cls} style={{ flex: n }} /> : null))}
              </div>
              <div className="row">
                {s.overdue > 0 && <span className="pill over"><span className="d" />{s.overdue} просрочени</span>}
                {s.scrap > 0 && <span className="pill scrap"><span className="d" />{s.scrap} брак</span>}
                {s.soon > 0 && <span className="pill soon"><span className="d" />{s.soon} скоро</span>}
                {clean && <span className="pill ok"><span className="d" />всичко наред</span>}
                <span className="tot">{s.total} 🧯</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="legend">
        <span><i style={{ background: "var(--over)" }} />Просрочен</span>
        <span><i style={{ background: "var(--soon)" }} />До 30 дни</span>
        <span><i style={{ background: "var(--scrap)" }} />Брак</span>
        <span><i style={{ background: "var(--ok)" }} />Изправен</span>
      </div>
    </div>
  );
}
