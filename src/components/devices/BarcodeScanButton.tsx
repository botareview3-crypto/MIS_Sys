"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";

// Uses the browser's native BarcodeDetector API (no extra dependency).
// Supported in Chromium-based browsers (Chrome, Edge, Android WebView);
// unsupported browsers get a friendly fallback message and can still type
// the barcode in by hand.
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    BarcodeDetector?: any;
  }
}

export function BarcodeScanButton({
  onScan,
  label = "Scan barcode",
}: {
  onScan: (value: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectorRef = useRef<any>(null);

  function stopStream() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function close() {
    stopStream();
    setOpen(false);
    setError(null);
    setStarting(false);
  }

  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
      setError("Barcode scanning isn't supported in this browser. Please type the barcode instead.");
      return;
    }

    let cancelled = false;
    setStarting(true);
    detectorRef.current = new window.BarcodeDetector({
      formats: ["code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "qr_code"],
    });

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setStarting(false);

        const scan = async () => {
          if (!videoRef.current || !detectorRef.current) return;
          try {
            const codes = await detectorRef.current.detect(videoRef.current);
            if (codes && codes.length > 0 && codes[0].rawValue) {
              onScan(codes[0].rawValue);
              close();
              return;
            }
          } catch {
            // Keep trying on transient detection errors (e.g. blurry frame).
          }
          rafRef.current = requestAnimationFrame(scan);
        };
        rafRef.current = requestAnimationFrame(scan);
      })
      .catch(() => {
        if (!cancelled) {
          setStarting(false);
          setError("Couldn't access the camera. Check permissions and try again, or type the barcode instead.");
        }
      });

    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className="flex shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-white/90 px-3 text-stone-500 transition hover:border-brand-400 hover:text-brand-600"
      >
        <Camera size={16} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">{label}</h3>
              <button
                type="button"
                onClick={close}
                className="text-xs font-medium text-stone-500 hover:text-stone-700"
              >
                Close
              </button>
            </div>

            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : (
              <div className="relative overflow-hidden rounded-lg bg-stone-900">
                <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
                {starting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="animate-spin text-white" size={24} />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-brand-500/80" />
              </div>
            )}

            {!error && (
              <p className="mt-2 text-xs text-stone-500">
                Point the camera at the barcode — it fills in automatically once recognized.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
