import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { getExtinguisher } from "@/lib/dashboard/queries";
import { GenerateProtocolButton } from "@/components/GenerateProtocolButton";
import RecordServiceForm from "@/components/RecordServiceForm";
import type { ExtinguisherType } from "@/lib/regulatory/types";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<ExtinguisherType, string> = {
  powder_abc: "Прахов ABC",
  powder_bc: "Прахов BC",
  water: "Воден",
  foam: "Водопенен",
  co2: "CO₂",
};
const KIND_LABEL: Record<string, string> = {
  TO: "Техническо обслужване",
  recharge: "Презареждане",
  powder_change: "Смяна на прах",
  foam_change: "Смяна на пенообразувател",
  HI: "Хидростатично изпитване",
};
const bg = (iso: string) => iso.split("-").reverse().join(".");

export default async function ExtinguisherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getExtinguisher(id);
  if (!data) notFound();
  const { ext, site, client, history } = data;

  const h = await headers();
  const host = h.get("host") ?? "antoan09-eood.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const qrUrl = `${proto}://${host}/pg/${ext.id}`;
  const qr = await QRCode.toDataURL(qrUrl, {
    margin: 1,
    width: 240,
    color: { dark: "#0b0c10", light: "#ffffff" },
  });

  return (
    <div className="wrap">
      <Link href={`/obekt/${site.id}`} className="back">← {site.name}</Link>

      <div className={`pg-card ${ext.status.level}`}>
        <div className="pg-head">
          <div className="pg-ico">🧯</div>
          <div className="pg-title">
            <div className="nm">{ext.model ?? TYPE_LABEL[ext.type]}</div>
            <div className="sn mono">№ {ext.serial_number} / {ext.manufacture_year}</div>
          </div>
          <div className={`chip ${ext.status.level}`}>{ext.status.label}</div>
        </div>

        <div className="pg-spec">
          <div><small>Вид</small><span>{TYPE_LABEL[ext.type]}</span></div>
          <div><small>Категория</small><span>{ext.category ?? "—"}</span></div>
          <div><small>Маса</small><span>{ext.mass_kg != null ? `${String(ext.mass_kg).replace(".", ",")} кг` : "—"}</span></div>
          <div><small>Произведен</small><span>{ext.manufacture_year}</span></div>
          <div><small>Щампа до</small><span>{ext.stamp_year ?? "—"}</span></div>
          <div><small>Следващ срок</small><span>{ext.status.nextDue ? bg(ext.status.nextDue) : "—"}</span></div>
        </div>

        <div className="pg-loc">
          <span>📍 {site.name}{site.address ? ` · ${site.address}` : ""}</span>
          <span>{client?.name}{client?.phone ? ` · ${client.phone}` : ""}</span>
        </div>

        <div className="btn-row">
          <GenerateProtocolButton siteId={site.id} extinguisherId={ext.id} label="📄 Нов протокол" />
          <Link className="btn" href="/skan" style={{ border: "1px solid var(--line2)", color: "inherit" }}>
            📸 Сканирай стикер
          </Link>
          <RecordServiceForm extinguisherId={ext.id} />
          {ext.status.level === "scrap" && (
            <span className="hint" style={{ color: "var(--scrap)" }}>Бракуван — не влиза в протокол за предаване.</span>
          )}
        </div>
      </div>

      <div className="grid2">
        <section>
          <div className="sec-h"><h2>История</h2><div className="meta">{history.length}</div></div>
          {history.length === 0 && <div className="hint">Няма записани обслужвания.</div>}
          {history.map((e, i) => (
            <div className="ev" key={i}>
              <div className="ev-dot" />
              <div>
                <div className="ev-k">{KIND_LABEL[e.kind] ?? e.kind}</div>
                <div className="ev-m">{bg(e.service_date)}{e.technician_name ? ` · ${e.technician_name}` : ""}</div>
              </div>
            </div>
          ))}
        </section>

        <section>
          <div className="sec-h"><h2>QR код</h2></div>
          <div className="qr-box">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR код на пожарогасителя" width={180} height={180} />
            <div className="hint">Отпечатай и залепи на пожарогасителя. Сканиране с телефон отваря тази карта.</div>
          </div>
        </section>
      </div>
    </div>
  );
}
