"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { getNavGroups } from "@/lib/nav";
import type { SessionPayload } from "@/lib/auth";

function initials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Sidebar({
  session,
  unreadNotifications,
}: {
  session: SessionPayload;
  unreadNotifications: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { workspace, administration } = getNavGroups(session.role);

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const renderGroup = (label: string, items: ReturnType<typeof getNavGroups>["workspace"]) => (
    <div className="mb-6">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon size={18} aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.showBadge && unreadNotifications > 0 && (
                <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  {unreadNotifications}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white">
          A
        </div>
        <strong className="text-sm font-semibold text-slate-900">MIS Repair</strong>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {renderGroup("Workspace", workspace)}
        {administration.length > 0 && renderGroup("Administration", administration)}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {initials(session.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{session.fullName}</p>
            <p className="truncate text-xs text-slate-500">{session.role}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <LogOut size={16} aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  );
}
