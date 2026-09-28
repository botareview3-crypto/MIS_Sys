"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import type { SessionPayload } from "@/lib/auth";

const COLLAPSE_KEY = "arp_sidebar_collapsed";

/**
 * Owns the sidebar's two display modes:
 * - Desktop (md and up): always visible; the top-bar toggle collapses it to
 *   an icon-only rail. The choice is remembered in this browser.
 * - Phones/small tablets (below md): the sidebar is an off-canvas drawer,
 *   closed by default so the page gets the full screen width. The top-bar
 *   menu button opens it; picking a link, tapping the backdrop, or pressing
 *   Escape closes it.
 */
export function AppShell({
  session,
  unreadNotifications,
  children,
}: {
  session: SessionPayload;
  unreadNotifications: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  // Restore the saved collapse choice (after mount, to match server HTML).
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage blocked — default to expanded */
    }
  }, []);

  // Track the md breakpoint so the collapsed rail only applies on desktop.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => {
      setIsDesktop(mq.matches);
      if (mq.matches) setMobileOpen(false);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Close the drawer after navigating.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Escape closes the drawer; lock page scroll behind it while open.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const toggleSidebar = useCallback(() => {
    if (isDesktop) {
      setCollapsed((c) => {
        const next = !c;
        try {
          localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
        } catch {
          /* ignore */
        }
        return next;
      });
    } else {
      setMobileOpen((o) => !o);
    }
  }, [isDesktop]);

  const compact = collapsed && isDesktop;

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
      <Sidebar
        session={session}
        compact={compact}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="no-scrollbar flex h-full min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <TopBar
          unreadNotifications={unreadNotifications}
          onToggleSidebar={toggleSidebar}
          sidebarOpen={isDesktop ? !collapsed : mobileOpen}
        />
        {children}
      </div>
    </div>
  );
}
