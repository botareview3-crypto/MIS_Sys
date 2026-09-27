import type { Prisma } from "@prisma/client";

/**
 * Canonical "is this job overdue" check — same definition
 * `syncRepairDeadlines()` (src/lib/repair-deadlines.ts) uses to generate
 * `repair_overdue` notifications: has an `expectedCompletionDate`, that date
 * is strictly before today (UTC midnight, since the column is a naive DATE
 * with no timezone), and the job hasn't reached `Delivered` yet.
 *
 * Kept here as a single source of truth so Work Queue and the Dashboard
 * don't each re-derive the same comparison slightly differently.
 */
export function isJobOverdue(job: { status: string; expectedCompletionDate: Date | null }): boolean {
  if (!job.expectedCompletionDate) return false;
  if (job.status === "Delivered") return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return job.expectedCompletionDate.getTime() < today.getTime();
}

/** Prisma `where` fragment matching `isJobOverdue`, for count()/findMany() queries. */
export function overdueWhereClause(): Prisma.RepairJobWhereInput {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return {
    status: { not: "Delivered" },
    expectedCompletionDate: { lt: today },
  };
}
