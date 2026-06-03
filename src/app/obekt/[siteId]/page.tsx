import Link from "next/link";
import { notFound } from "next/navigation";
import { getSite } from "@/lib/dashboard/queries";
import { GenerateProtocolButton } from "@/components/GenerateProtocolButton";
import type { ExtinguisherType } from "@/lib/regulatory/types";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<ExtinguisherType, string> = {
  powder_abc: "Прахов ABC",
  powder_bc: "Прахов BC",
  water: "Воден",
  foam: "Водопенен",
  co2: "CO₂",
};

function bg(iso: string): string {
  return iso.split("-").reverse().join(".");
}

export default async function SitePage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const data = await getSite(siteId);
  if (!data) notFound();
  const { site, client, extinguishers } = data;

  const c = (lvl: string) => extinguishers.filter((e) => e.status.level === lvl).length;

  return (
    <div className="wrap">
      <Link href="/" className="back">← Обекти</Link>

      <div className="detail-head">
        <h2>{site.name}</h2>
        <div className="cl">
          {client?.name}
          {site.address ? ` · ${site.address}` : ""}
          {client?.phone ? ` · ${client.phone}` : ""}
        </div>
        <div className="totals">
          <div><span>{extinguishers.length}</span><small>Общо</small></div>
          <div><span style={{ color: "var(--over)" }}>{c("overdue")}</span><small>Просрочени</small></div>
          <div><span style={{ color: "var(--soon)" }}>{c("soon")}</span><small>За скоро</small></div>
          <div><span style={{ color: "var(--scrap)" }}>{c("scrap")}</span><small>За брак</small></div>
        </div>
        <div className="btn-row">
          <GenerateProtocolButton siteId={site.id} />
          <span className="hint">Бракуваните не влизат в протокола за предаване.</span>
        </div>
      </div>

      <div className="sec-h"><h2>Пожарогасители</h2><div className="meta">{extinguishers.length}</div></div>
      {extinguishers.map((e) => (
        <Link key={e.id} href={`/pg/${e.id}`} className={`ext ${e.status.level}`}>
          <div className="ico">🧯</div>
          <div className="main">
            <div className="nm">{e.model ?? TYPE_LABEL[e.type]}</div>
            <div className="meta">
              <span className="sn">№ {e.serial_number} / {e.manufacture_year}</span>
              <span>{TYPE_LABEL[e.type]}</span>
              {e.category && <span>кат. {e.category}</span>}
              {e.mass_kg != null && <span>{String(e.mass_kg).replace(".", ",")} кг</span>}
            </div>
          </div>
          <div className="st">
            <div className="lab">{e.status.label}</div>
            {e.status.nextDue && <div className="due">срок {bg(e.status.nextDue)}</div>}
          </div>
        </Link>
      ))}
    </div>
  );
}
