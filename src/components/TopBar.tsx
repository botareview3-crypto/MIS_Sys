"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Loader2 } from "lucide-react";

type NotificationSummary = {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
};

/**
 * Persistent top bar shown above every authenticated page. Replaces the
 * sidebar's old "Notifications" nav item (removed from src/lib/nav.ts
 * 2026-09-26) as the only entry point to notifications: click the bell to
 * see recent ones in a dropdown, or "See all notifications" to load the
 * full /notifications page. Badges the unread count in red and shakes
 * while there's anything unread.
 */
export function TopBar({ unreadNotifications }: { unreadNotifications: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationSummary[]>([]);
  const [unread, setUnread] = useState(unreadNotifications);
  const containerRef = useRef<HTMLDivElement>(null);

  // The server only recomputes this on a full page load/refresh; keep the
  // badge in sync when that happens while the dropdown is closed.
  useEffect(() => {
    setUnread(unreadNotifications);
  }, [unreadNotifications]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setItems(data.notifications ?? []);
        setUnread(data.unreadCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: number) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnread((prev) => Math.max(0, prev - 1));
    await fetch(`/api/notifications/${id}/read`, { method: "POST" }).catch(() => {});
  }

  function seeAll() {
    setOpen(false);
    router.push("/notifications");
  }

  const hasUnread = unread > 0;
  const displayCount = unread > 99 ? "99+" : String(unread);
  const active = pathname.startsWith("/notifications");

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-end border-b border-slate-200 bg-white px-6">
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={toggleOpen}
          aria-label={hasUnread ? `Notifications, ${unread} unread` : "Notifications"}
          aria-expanded={open}
          aria-haspopup="true"
          className={`relative flex h-10 w-10 items-center justify-center rounded-full transition ${
            active || open ? "bg-brand-50" : "hover:bg-slate-100"
          }`}
        >
          <Bell
            size={20}
            aria-hidden
            className={
              hasUnread
                ? "animate-bell-shake text-red-600 motion-reduce:animate-none"
                : "text-slate-500"
            }
          />
          {hasUnread && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white"
              aria-hidden
            >
              {displayCount}
            </span>
          )}
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-12 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              {hasUnread && <p className="text-xs text-slate-500">{unread} unread</p>}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500">
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  Loading…
                </div>
              ) : items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">No notifications yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => !n.isRead && markRead(n.id)}
                        className={`flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition hover:bg-slate-50 ${
                          n.isRead ? "" : "bg-brand-50/40"
                        }`}
                      >
                        <div className="flex w-full items-center gap-2">
                          {!n.isRead && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden />
                          )}
                          <span className="flex-1 truncate text-sm font-medium text-slate-900">
                            {n.title}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-xs text-slate-500">{n.message}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              onClick={seeAll}
              className="block w-full border-t border-slate-100 px-4 py-3 text-center text-sm font-medium text-brand-700 hover:bg-slate-50"
            >
              See all notifications
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
