"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WhatsappMessageType } from "@/lib/whatsapp";

/**
 * Ported from the <form> + live preview + `oninput` handler on
 * whatsapp-message.php. Submitting POSTs the (possibly edited) message to
 * the API route, which logs it and returns the wa.me URL; on success we
 * open that URL in a new tab (rather than the original's server-side
 * `header('Location: ...')` redirect) so staff don't lose this page — they
 * can send the message in the new tab and come straight back here.
 */
export function WhatsappMessageForm({
  deviceId,
  messageType,
  normalizedPhone,
  initialMessage,
  disabled,
}: {
  deviceId: number;
  messageType: WhatsappMessageType;
  normalizedPhone: string;
  initialMessage: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const res = await fetch(`/api/devices/${deviceId}/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageType, generatedMessage: message }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "The WhatsApp message could not be prepared.");
      }
      window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
      if (data.statusAutoAdvancedToRepairing) {
        setNotice("Message saved — status was automatically updated to Repairing.");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The WhatsApp message could not be prepared.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-5">
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Recipient Number</label>
        <input className="input bg-slate-50" value={normalizedPhone} readOnly />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">WhatsApp Message</label>
        <textarea
          className="input"
          rows={9}
          maxLength={2000}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-400">
          Outlook passwords and other credentials must never be included in this message.
        </p>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700">Message Preview</p>
        <p className="whitespace-pre-wrap text-sm text-slate-800">{message}</p>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-400">Message will be logged after opening WhatsApp.</span>
        <button
          type="submit"
          disabled={disabled || loading || !normalizedPhone}
          className="btn-primary"
        >
          {loading ? "Saving…" : "Save & Open WhatsApp"}
        </button>
      </div>
    </form>
  );
}
