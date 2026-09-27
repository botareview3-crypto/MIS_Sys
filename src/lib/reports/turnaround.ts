import { prisma } from "@/lib/prisma";

/**
 * Item 6 (Reports charts): all aggregation done here in plain JS over a
 * `findMany`, matching how the rest of this codebase already handles
 * grouping (e.g. Work Queue's status totals) rather than reaching for raw
 * SQL `GROUP BY` — this is a small repair-shop dataset, not a warehouse.
 */

const MAX_PROBLEM_GROUPS = 6;
const REGISTRATION_WEEKS = 12;
const REGISTRATION_MONTHS = 6;

export type TurnaroundGroup = { label: string; avgDays: number; count: number };
export type RegistrationBucket = { label: string; count: number };

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Average days from receivedAt to deliveredAt for Delivered jobs, grouped
 * by the exact `reportedProblem` text. `reportedProblem` is either the one
 * fixed "standard" string or arbitrary free text typed in for "Other"
 * (see src/lib/reported-problems.ts) — there's no real enum to group by,
 * so this groups by literal text and folds every group past the top
 * `MAX_PROBLEM_GROUPS` (by job count) into a single "Other" bar, so one-off
 * free-text problems can't turn the chart into an unreadable wall of bars.
 */
export async function turnaroundByProblemType(): Promise<TurnaroundGroup[]> {
  const jobs = await prisma.repairJob.findMany({
    where: { status: "Delivered", deliveredAt: { not: null } },
    select: { reportedProblem: true, receivedAt: true, deliveredAt: true },
  });

  const groups = new Map<string, { totalDays: number; count: number }>();
  for (const job of jobs) {
    if (!job.deliveredAt) continue;
    const key = job.reportedProblem.trim() || "Unspecified";
    const g = groups.get(key) ?? { totalDays: 0, count: 0 };
    g.totalDays += daysBetween(job.receivedAt, job.deliveredAt);
    g.count += 1;
    groups.set(key, g);
  }

  const sorted = [...groups.entries()].sort((a, b) => b[1].count - a[1].count);
  const top = sorted.slice(0, MAX_PROBLEM_GROUPS);
  const rest = sorted.slice(MAX_PROBLEM_GROUPS);

  const result: TurnaroundGroup[] = top.map(([label, g]) => ({
    label: label.length > 32 ? label.slice(0, 29) + "…" : label,
    avgDays: round1(g.totalDays / g.count),
    count: g.count,
  }));

  if (rest.length > 0) {
    const restTotal = rest.reduce((sum, [, g]) => sum + g.totalDays, 0);
    const restCount = rest.reduce((sum, [, g]) => sum + g.count, 0);
    result.push({ label: "Other", avgDays: round1(restTotal / restCount), count: restCount });
  }

  return result;
}

/**
 * Same average, grouped by the technician *currently* assigned
 * (`assignedTechnicianId`) — not who was assigned at delivery time, since
 * nothing in this schema snapshots that. Jobs with no technician assigned
 * are excluded rather than lumped into an "Unassigned" bar, since that
 * wouldn't reflect any one person's turnaround.
 */
export async function turnaroundByTechnician(): Promise<TurnaroundGroup[]> {
  const jobs = await prisma.repairJob.findMany({
    where: { status: "Delivered", deliveredAt: { not: null }, assignedTechnicianId: { not: null } },
    select: { receivedAt: true, deliveredAt: true, technician: { select: { fullName: true } } },
  });

  const groups = new Map<string, { totalDays: number; count: number }>();
  for (const job of jobs) {
    if (!job.deliveredAt || !job.technician) continue;
    const key = job.technician.fullName;
    const g = groups.get(key) ?? { totalDays: 0, count: 0 };
    g.totalDays += daysBetween(job.receivedAt, job.deliveredAt);
    g.count += 1;
    groups.set(key, g);
  }

  return [...groups.entries()]
    .map(([label, g]) => ({ label, avgDays: round1(g.totalDays / g.count), count: g.count }))
    .sort((a, b) => b.avgDays - a.avgDays);
}

/** Devices registered per calendar week (Mon-start, UTC) over the last `weeks` weeks, oldest first. */
export async function registrationsByWeek(weeks: number = REGISTRATION_WEEKS): Promise<RegistrationBucket[]> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dayOfWeek = (today.getUTCDay() + 6) % 7; // 0 = Monday
  const currentWeekStart = new Date(today);
  currentWeekStart.setUTCDate(today.getUTCDate() - dayOfWeek);
  const earliestStart = new Date(currentWeekStart);
  earliestStart.setUTCDate(currentWeekStart.getUTCDate() - (weeks - 1) * 7);

  const jobs = await prisma.repairJob.findMany({
    where: { receivedAt: { gte: earliestStart } },
    select: { receivedAt: true },
  });

  const buckets: RegistrationBucket[] = [];
  for (let i = 0; i < weeks; i++) {
    const bucketStart = new Date(earliestStart);
    bucketStart.setUTCDate(earliestStart.getUTCDate() + i * 7);
    const bucketEnd = new Date(bucketStart);
    bucketEnd.setUTCDate(bucketStart.getUTCDate() + 7);
    const count = jobs.filter((j) => j.receivedAt >= bucketStart && j.receivedAt < bucketEnd).length;
    buckets.push({ label: bucketStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }), count });
  }
  return buckets;
}

/** Devices registered per calendar month (UTC) over the last `months` months, oldest first. */
export async function registrationsByMonth(months: number = REGISTRATION_MONTHS): Promise<RegistrationBucket[]> {
  const today = new Date();
  const currentMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const earliestStart = new Date(
    Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() - (months - 1), 1),
  );

  const jobs = await prisma.repairJob.findMany({
    where: { receivedAt: { gte: earliestStart } },
    select: { receivedAt: true },
  });

  const buckets: RegistrationBucket[] = [];
  for (let i = 0; i < months; i++) {
    const bucketStart = new Date(Date.UTC(earliestStart.getUTCFullYear(), earliestStart.getUTCMonth() + i, 1));
    const bucketEnd = new Date(Date.UTC(bucketStart.getUTCFullYear(), bucketStart.getUTCMonth() + 1, 1));
    const count = jobs.filter((j) => j.receivedAt >= bucketStart && j.receivedAt < bucketEnd).length;
    buckets.push({ label: bucketStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), count });
  }
  return buckets;
}
