"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";

// Uses @zxing/browser (pure-JS decoding over a <video> frame via canvas),
// not the native BarcodeDetector API — BarcodeDetector only ships in
// Chromium browsers, so Safari and Firefox always hit the "unsupported"
// fallback. zxing works the same way across all modern browsers, including
// iOS/macOS Safari and Firefox, which is what actually gets carried around
// on phones for intake. Both packages are lazy-loaded on first open so they
// don't add weight to the initial page bundle.
type ScannerControls = { stop: () => void };

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
  const controlsRef = useRef<ScannerControls | null>(null);

  function stopScan() {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }

  function close() {
    stopScan();
    setOpen(false);
    setError(null);
    setStarting(false);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStarting(true);

    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelled) return;

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.ITF,
          BarcodeFormat.QR_CODE,
        ]);
        const reader = new BrowserMultiFormatReader(hints);

        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current ?? undefined,
          (result, _err, ctrls) => {
            if (cancelled || !result) return; // no barcode in this frame yet — keep scanning
            ctrls.stop();
            controlsRef.current = null;
            onScan(result.getText());
            setOpen(false);
            setError(null);
            setStarting(false);
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStarting(false);
      } catch {
        if (!cancelled) {
          setStarting(false);
          setError("Couldn't access the camera. Check permissions and try again, or type the barcode instead.");
        }
      }
    })();

    return () => {
      cancelled = true;
      stopScan();
    };
  }, [open, onScan]);

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
