"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

/**
 * Persistent top bar shown above every authenticated page. Currently just
 * the notification bell (moved out of the sidebar list into a bell here
 * per project owner request 2026-09-26) — badges with the unread count,
 * turns red, and shakes while there's anything unread. The sidebar's
 * "Notifications" nav item (src/lib/nav.ts) is left as-is; this is an
 * additional, more visible entry point to the same /notifications page,
 * not a replacement.
 */
export function TopBar({ unreadNotifications }: { unreadNotifications: number }) {
  const pathname = usePathname();
  const hasUnread = unreadNotifications > 0;
  const active = pathname.startsWith("/notifications");
  const displayCount = unreadNotifications > 99 ? "99+" : String(unreadNotifications);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-end border-b border-slate-200 bg-white px-6">
      <Link
        href="/notifications"
        aria-label={hasUnread ? `Notifications, ${unreadNotifications} unread` : "Notifications"}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full transition ${
          active ? "bg-brand-50" : "hover:bg-slate-100"
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
      </Link>
    </header>
  );
}
