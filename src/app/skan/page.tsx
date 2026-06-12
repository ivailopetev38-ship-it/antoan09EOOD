"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StickerScan from "@/components/StickerScan";

type Detector = { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  // Камерата се пуска САМО при докосване на бутона (не стряска с искане за достъп при отваряне).
  const [mode, setMode] = useState<"idle" | "scanning" | "unsupported">("idle");
  const [err, setErr] = useState<string | null>(null);
  const cleanupRef = useRef<() => void>(() => {});

  useEffect(() => {
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Ctor) setMode("unsupported");
    return () => cleanupRef.current();
  }, []);

  async function startScanner() {
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Ctor) {
      setMode("unsupported");
      return;
    }
    setErr(null);
    setMode("scanning");
    const detector = new Ctor({ formats: ["qr_code"] });
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    cleanupRef.current = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };

    function goTo(value: string) {
      cleanupRef.current();
      try {
        const u = new URL(value);
        router.push(u.pathname + u.search);
      } catch {
        router.push(`/pg/${value}`);
      }
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play();
      }
      const tick = async () => {
        if (stopped || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            goTo(codes[0].rawValue);
            return;
          }
        } catch {
          /* продължаваме да сканираме */
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch {
      setErr("Няма достъп до камера. Разреши камерата в браузъра.");
      setMode("idle");
    }
  }

  function stopScanner() {
    cleanupRef.current();
    setMode("idle");
  }

  return (
    <div className="wrap">
      <Link href="/" className="back">← Табло</Link>

      <StickerScan />

      <div className="sec-h" style={{ marginTop: 28 }}><h2>или сканирай QR код</h2></div>

      {mode === "unsupported" ? (
        <div className="scan-box">
          <p className="hint">
            Този браузър не поддържа вграден скенер. Използвай камерата на телефона директно върху QR кода —
            той отваря картата на пожарогасителя автоматично.
          </p>
        </div>
      ) : (
        <div className="scan-box">
          {/* видеото стои в DOM (скрито), за да е готово когато камерата тръгне */}
          <div style={{ display: mode === "scanning" ? undefined : "none" }}>
            <video ref={videoRef} playsInline muted className="scan-video" />
            <div className="scan-frame" />
            <p className="hint scan-hint">Насочи камерата към QR кода на пожарогасителя.</p>
            <button className="btn" style={{ marginTop: 10, border: "1px solid var(--line2)", color: "inherit" }} onClick={stopScanner}>
              ⏹ Спри скенера
            </button>
          </div>
          {mode === "idle" && (
            <>
              <button className="btn btn-fire" style={{ fontSize: 16, padding: "16px 22px", width: "100%" }} onClick={startScanner}>
                🔍 Пусни QR скенера
              </button>
              <p className="hint scan-hint">Камерата се включва само когато я пуснеш.</p>
            </>
          )}
          {err && <p className="hint" style={{ color: "var(--over)", marginTop: 8 }}>{err}</p>}
        </div>
      )}
    </div>
  );
}
