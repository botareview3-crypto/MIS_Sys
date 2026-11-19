"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ChevronDown, ChevronRight, X } from "lucide-react";
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
  compact = false,
  mobileOpen = false,
  onCloseMobile,
}: {
  session: SessionPayload;
  /** Desktop icon-only rail. */
  compact?: boolean;
  /** Phone drawer visibility (below md the sidebar is off-canvas). */
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { workspace, administration } = getNavGroups(session.role);
  // Local/Intra (and any future parent items) default to expanded.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Sibling routes can share a prefix (e.g. "/devices/register" starts with
  // "/devices"), so a plain startsWith would light up both "Manage Devices"
  // and "Register Device" at once. Instead, find every href in the sidebar
  // that matches the current path and only light up the longest (most
  // specific) one.
  function collectHrefs(items: NavItem[]): string[] {
    return items.flatMap((item) => [
      ...(item.href ? [item.href] : []),
      ...(item.children ? collectHrefs(item.children) : []),
    ]);
  }
  const allHrefs = [...collectHrefs(workspace), ...collectHrefs(administration)];
  const matchingHrefs = allHrefs.filter((href) =>
    href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/")
  );
  const activeHref = matchingHrefs.sort((a, b) => b.length - a.length)[0];

  function isActive(href: string) {
    return href === activeHref;
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
        title={compact ? item.label : undefined}
        aria-label={compact ? item.label : undefined}
        className={`relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          compact ? "justify-center" : ""
        } ${
          indent && !compact ? "ml-4" : ""
        } ${
          active
            ? "bg-brand-gradient text-white shadow-glow"
            : "text-ink-muted hover:translate-x-0.5 hover:bg-white/[0.06] hover:text-white"
        }`}
      >
        <Icon size={18} aria-hidden />
        {!compact && <span className="flex-1">{item.label}</span>}
      </Link>
    );
  };

  const renderGroup = (label: string, items: ReturnType<typeof getNavGroups>["workspace"]) => (
    <div className="mb-6">
      {compact ? (
        <div className="mx-3 mb-3 border-t border-white/10" aria-hidden />
      ) : (
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-ink-muted/60">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {items.map((item) => {
          if (item.children && item.children.length > 0 && compact) {
            // Icon rail: no room for a collapsible parent, so list the
            // children directly (tooltips carry the labels).
            return (
              <div key={item.label} className="space-y-1">
                {item.children.map((child) =>
                  renderLink(child, `${item.label}-${child.href}`, false)
                )}
              </div>
            );
          }
          if (item.children && item.children.length > 0) {
            const Icon = item.icon;
            const open = isGroupOpen(item.label);
            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(item.label)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-ink-muted transition hover:bg-white/[0.06] hover:text-white"
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
                  <div className="mt-0.5 space-y-1 border-l border-white/10 pl-1">
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
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-[100dvh] w-64 max-w-[85vw] shrink-0 flex-col overflow-hidden bg-ink-gradient transition-[transform,width] duration-200 ease-out md:static md:z-auto md:h-full md:max-w-none md:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } ${compact ? "md:w-[76px]" : "md:w-64"}`}
    >
      <div
        className="pointer-events-none absolute -left-16 -top-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-pop-pink/20 blur-3xl"
        aria-hidden
      />

      <div className={`relative flex items-center gap-2.5 px-4 py-5 ${compact ? "justify-center" : ""}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient font-display text-sm font-bold text-white shadow-glow">
          A
        </div>
        {!compact && (
          <strong className="flex-1 font-display text-sm font-semibold text-white">MIS Repair</strong>
        )}
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="rounded-xl p-1.5 text-ink-muted transition hover:bg-white/[0.08] hover:text-white md:hidden"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      <nav className="no-scrollbar relative flex-1 overflow-y-auto px-3 py-2">
        {renderGroup("Workspace", workspace)}
        {administration.length > 0 && renderGroup("Administration", administration)}
      </nav>

      <div className="relative border-t border-white/[0.08] p-3">
        <div
          className={`flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/[0.05] ${
            compact ? "flex-col" : ""
          }`}
          title={compact ? `${session.fullName} (${session.role})` : undefined}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white shadow-glow">
            {initials(session.fullName)}
          </div>
          {!compact && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{session.fullName}</p>
              <p className="truncate text-xs text-ink-muted">{session.role}</p>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out"
            className="rounded-xl p-1.5 text-ink-muted transition hover:bg-white/[0.08] hover:text-white"
          >
            <LogOut size={16} aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  );
}
