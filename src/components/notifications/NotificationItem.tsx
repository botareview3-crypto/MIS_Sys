"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, User, Wrench, Bell, UserCircle, Link as LinkIcon, Clock, Check } from "lucide-react";

/** Mirrors the icon-picking logic in notifications.php: substring match on notification_type. */
function iconFor(notificationType: string) {
  const t = notificationType.toLowerCase();
  if (t.includes("delete")) return Trash2;
  if (t.includes("user")) return User;
  if (t.includes("repair")) return Wrench;
  return Bell;
}

export function NotificationItem({
  id,
  notificationType,
  title,
  message,
  recordReference,
  isRead,
  createdAt,
  createdByName,
}: {
  id: number;
  notificationType: string;
  title: string;
  message: string;
  recordReference: string | null;
  isRead: boolean;
  createdAt: string;
  createdByName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const Icon = iconFor(notificationType);

  async function markRead() {
    setBusy(true);
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`flex gap-4 px-5 py-4 ${isRead ? "bg-white" : "bg-brand-50/40"}`}>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          isRead ? "bg-slate-100 text-slate-500" : "bg-blue-100 text-blue-600"
        }`}
      >
        <Icon size={18} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {notificationType.replace(/_/g, " ")}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              isRead ? "bg-slate-100 text-slate-400" : "bg-blue-50 text-blue-600 ring-1 ring-blue-200"
            }`}
          >
            {isRead ? "Read" : "Unread"}
          </span>
        </div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{message}</p>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1">
            <UserCircle size={13} aria-hidden /> {createdByName}
          </span>
          {recordReference && (
            <span className="inline-flex items-center gap-1">
              <LinkIcon size={13} aria-hidden /> {recordReference}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock size={13} aria-hidden />
            {new Date(createdAt).toLocaleString(undefined, {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {!isRead && (
            <button
              type="button"
              disabled={busy}
              onClick={markRead}
              className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-brand-600 disabled:opacity-60"
            >
              <Check size={14} aria-hidden /> Mark as read
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
