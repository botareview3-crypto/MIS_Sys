"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { getNavGroups, type NavItem } from "@/lib/nav";
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
}: {
  session: SessionPayload;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { workspace, administration } = getNavGroups(session.role);
  // Local/Intra (and any future parent items) default to expanded.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  function isGroupOpen(label: string) {
    return openGroups[label] ?? true;
  }

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !isGroupOpen(label) }));
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const renderLink = (item: NavItem, keyPrefix: string, indent: boolean) => {
    const Icon = item.icon;
    const active = isActive(item.href!);
    return (
      <Link
        key={keyPrefix}
        href={item.href!}
        aria-current={active ? "page" : undefined}
        className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
          indent ? "ml-4" : ""
        } ${
          active
            ? "bg-white/[0.07] text-white"
            : "text-ink-muted hover:bg-white/[0.04] hover:text-white"
        }`}
      >
        {active && (
          <span className="absolute -left-3 top-1/2 h-4 w-0.5 -transtone-y-1/2 rounded-full bg-brand-500" aria-hidden />
        )}
        <Icon size={18} aria-hidden />
        <span className="flex-1">{item.label}</span>
      </Link>
    );
  };

  const renderGroup = (label: string, items: ReturnType<typeof getNavGroups>["workspace"]) => (
    <div className="mb-6">
      <p className="mb-2 px-3 text-xs font-medium tracking-wide text-ink-muted/70">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => {
          if (item.children && item.children.length > 0) {
            const Icon = item.icon;
            const open = isGroupOpen(item.label);
            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(item.label)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-white/[0.04] hover:text-white"
                  aria-expanded={open}
                >
                  <Icon size={18} aria-hidden />
                  <span className="flex-1 text-left">{item.label}</span>
                  {open ? (
                    <ChevronDown size={16} aria-hidden />
                  ) : (
                    <ChevronRight size={16} aria-hidden />
                  )}
                </button>
                {open && (
                  <div className="mt-0.5 space-y-0.5">
                    {item.children.map((child) =>
                      renderLink(child, `${item.label}-${child.href}`, true)
                    )}
                  </div>
                )}
              </div>
            );
          }
          return renderLink(item, item.href! + item.label, false);
        })}
      </div>
    </div>
  );

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-ink">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-500 font-display text-sm font-bold text-white">
          A
        </div>
        <strong className="font-display text-sm font-semibold text-white">MIS Repair</strong>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {renderGroup("Workspace", workspace)}
        {administration.length > 0 && renderGroup("Administration", administration)}
      </nav>

      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-xs font-semibold text-white">
            {initials(session.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{session.fullName}</p>
            <p className="truncate text-xs text-ink-muted">{session.role}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out"
            className="rounded-md p-1.5 text-ink-muted hover:bg-white/[0.06] hover:text-white"
          >
            <LogOut size={16} aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  );
}
