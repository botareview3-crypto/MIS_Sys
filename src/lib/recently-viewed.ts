import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";

/**
 * Section 8 (recently-viewed devices): tracked per-browser via a small
 * cookie rather than a new Prisma model/table. This is a personalization
 * convenience, not data anyone else needs to see or query, so it doesn't
 * warrant a schema change (CLAUDE.md flags those as needing sign-off) —
 * a plain cookie keeps this section entirely additive: no migration, no
 * new table for `Arp-main`'s still-shared production DB to carry.
 * Trade-off, stated plainly: the list is per-browser, not per-account, so
 * it won't follow a user who signs in on a different device/browser.
 */
export const RECENTLY_VIEWED_COOKIE = "arp_recent_devices";
export const RECENTLY_VIEWED_MAX = 6;

/** Parses the raw cookie value into a de-duplicated array of positive device ids, most-recent-first. */
export function parseRecentlyViewedCookie(raw: string | undefined): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<number>();
    const ids: number[] = [];
    for (const value of parsed) {
      const id = Number(value);
      if (Number.isInteger(id) && id > 0 && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
        if (ids.length >= RECENTLY_VIEWED_MAX) break;
      }
    }
    return ids;
  } catch {
    return [];
  }
}

/** Moves `deviceId` to the front of the list (inserting it if new), capped at RECENTLY_VIEWED_MAX. */
export function withRecentlyViewed(existingRaw: string | undefined, deviceId: number): number[] {
  const existing = parseRecentlyViewedCookie(existingRaw);
  return [deviceId, ...existing.filter((id) => id !== deviceId)].slice(0, RECENTLY_VIEWED_MAX);
}

type RecentlyViewedJob = {
  id: number;
  jobId: string;
  hostname: string | null;
  status: string;
  expectedCompletionDate: Date | null;
  customer: { fullName: string };
};

/**
 * Loads the devices referenced by the cookie, scoped the same way
 * `loadDeviceForRole` scopes a single device — a Secondary Admin only
 * ever sees ones still assigned to them, everyone else sees whatever's in
 * the cookie. Devices the cookie remembers but the viewer can no longer
 * see (reassigned away, deleted) are silently dropped, not errored on.
 * Returned in the cookie's own most-recent-first order (Prisma's `in`
 * doesn't preserve that, so it's re-sorted after the query).
 */
export async function getRecentlyViewedDevices(
  cookieRaw: string | undefined,
  session: SessionPayload,
): Promise<RecentlyViewedJob[]> {
  const ids = parseRecentlyViewedCookie(cookieRaw);
  if (ids.length === 0) return [];

  const jobs = await prisma.repairJob.findMany({
    where: {
      id: { in: ids },
      ...(session.role === "Secondary Admin" ? { assignedSecondaryAdminId: session.userId } : {}),
    },
    select: {
      id: true,
      jobId: true,
      hostname: true,
      status: true,
      expectedCompletionDate: true,
      customer: { select: { fullName: true } },
    },
  });

  const byId = new Map(jobs.map((j) => [j.id, j]));
  return ids.map((id) => byId.get(id)).filter((j): j is RecentlyViewedJob => Boolean(j));
}
