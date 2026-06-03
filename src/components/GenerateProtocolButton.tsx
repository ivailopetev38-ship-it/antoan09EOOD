"use client";
import { useState } from "react";

export function GenerateProtocolButton({ siteId }: { siteId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/protocols/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      });
      if (!res.ok) {
        setErr(`Грешка при генериране (${res.status}).`);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="(.+?)"/.exec(cd);
      const name = match?.[1] ?? "protokol.docx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErr("Мрежова грешка.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn-fire" onClick={generate} disabled={busy}>
        {busy ? "Генерирам…" : "📄 Генерирай протокол"}
      </button>
      {err && <span className="hint" style={{ color: "var(--over)" }}>{err}</span>}
    </>
  );
}
