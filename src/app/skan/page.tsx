"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StickerScan from "@/components/StickerScan";

type Detector = { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> };

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const [mode, setMode] = useState<"scanning" | "unsupported">("scanning");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    function goTo(value: string) {
      stopped = true;
      try {
        const u = new URL(value);
        router.push(u.pathname + u.search);
      } catch {
        router.push(`/pg/${value}`);
      }
    }

    async function start() {
      const Ctor = (window as unknown as {
        BarcodeDetector?: new (o: { formats: string[] }) => Detector;
      }).BarcodeDetector;
      if (!Ctor) {
        setMode("unsupported");
        return;
      }
      const detector = new Ctor({ formats: ["qr_code"] });
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
            /* keep scanning */
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setErr("Няма достъп до камера. Разреши камерата в браузъра.");
      }
    }

    void start();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  return (
    <div className="wrap">
      <Link href="/" className="back">← Табло</Link>
      <div className="sec-h"><h2>QR Скенер</h2></div>

      {mode === "scanning" ? (
        <div className="scan-box">
          <video ref={videoRef} playsInline muted className="scan-video" />
          <div className="scan-frame" />
          <p className="hint scan-hint">Насочи камерата към QR кода на пожарогасителя.</p>
          {err && <p className="hint" style={{ color: "var(--over)" }}>{err}</p>}
        </div>
      ) : (
        <div className="scan-box">
          <p className="hint">
            Този браузър не поддържа вграден скенер. Използвай камерата на телефона директно върху QR кода —
            той отваря картата на пожарогасителя автоматично.
          </p>
        </div>
      )}

      <StickerScan />
    </div>
  );
}
