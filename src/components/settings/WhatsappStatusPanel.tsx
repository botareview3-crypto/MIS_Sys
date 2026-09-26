"use client";

import { useEffect, useState } from "react";

type StatusResponse = {
  status: "initializing" | "qr" | "authenticated" | "ready" | "disconnected" | "error";
  qrDataUrl: string | null;
  lastError: string | null;
};

/** Polls /api/whatsapp/status every 4s and shows the QR code or connection state. */
export default function WhatsappStatusPanel() {
  const [state, setState] = useState<StatusResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/whatsapp/status", { cache: "no-store" });
        if (!res.ok) return;
        const data: StatusResponse = await res.json();
        if (!cancelled) setState(data);
      } catch {
        // Best-effort polling — a transient network hiccup just tries again.
      }
    }

    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!state) {
    return <p className="text-sm text-slate-500">Checking WhatsApp connection…</p>;
  }

  if (state.status === "ready") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        WhatsApp is connected. Received and Ready messages will send automatically.
      </div>
    );
  }

  if (state.status === "qr" && state.qrDataUrl) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm text-slate-600">
          On the phone you&apos;re pairing: open WhatsApp → Settings → Linked Devices → Link a
          Device, then scan this code.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={state.qrDataUrl} alt="WhatsApp pairing QR code" className="h-64 w-64" />
        <p className="mt-3 text-xs text-slate-400">This refreshes on its own if it expires.</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        WhatsApp connection error{state.lastError ? `: ${state.lastError}` : "."}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      Status: {state.status}
      {state.lastError ? ` — ${state.lastError}` : ""}
      {state.status === "initializing" && " (this can take up to a minute on a cold start)"}
    </div>
  );
}
