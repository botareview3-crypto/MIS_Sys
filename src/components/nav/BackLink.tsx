"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Shared "back" navigation control, added 2026-09-26 to standardize the
 * "← Back to X" pattern that already existed ad hoc on a couple of pages
 * (devices/[id]/manufacturer, devices/[id]/whatsapp) before any other page
 * had it. Same look, now reused everywhere a page needs a way back.
 *
 * Two modes:
 * - Default (`useHistory` false/omitted): a plain link to `href`. Use this
 *   when the page has exactly one logical parent (e.g. Edit Device is only
 *   ever reached from that device's detail page).
 * - `useHistory` true: renders a button that calls `router.back()` so the
 *   user returns to wherever they actually came from, falling back to
 *   `href` only when there's no in-app history (direct link, bookmark, new
 *   tab). Use this for pages reachable from more than one place, where a
 *   single hardcoded parent would be wrong some of the time (e.g. Device
 *   Details, reached from the devices list, Work Queue, the dashboard, and
 *   the receipt preview page).
 */
export function BackLink({
  href,
  label,
  useHistory = false,
  className = "text-sm text-slate-500 hover:text-slate-700",
}: {
  href: string;
  label: string;
  useHistory?: boolean;
  className?: string;
}) {
  const router = useRouter();

  if (!useHistory) {
    return (
      <Link href={href} className={className}>
        ← {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(href);
        }
      }}
      className={className}
    >
      ← {label}
    </button>
  );
}
