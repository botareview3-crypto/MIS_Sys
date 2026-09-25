import { prisma } from "@/lib/prisma";

/** Ported from validExpectedCompletionDate() in includes/repair-deadlines.php. */
export function validExpectedCompletionDate(value: string): boolean {
  if (value === "") return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** Formats a Date as "25 Sep 2026", matching the original's TO_CHAR(date, 'DD Mon YYYY'). */
function formatOverdueDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

export type SyncRepairDeadlinesResult = {
  overdueJobsChecked: number;
  notificationsCreated: number;
};

/**
 * Ported from syncRepairDeadlines() in includes/repair-deadlines.php.
 *
 * Creates one "repair_overdue" notification per (recipient, job) pair for
 * every non-Delivered repair job past its expected_completion_date, skipping
 * any pair that already has one — so this is safe to call repeatedly (e.g.
 * on a schedule) without spamming duplicate notifications for the same job.
 *
 * Recipients, same set as the original's CROSS JOIN LATERAL ... UNION:
 *   - the job's assigned technician (if any)
 *   - the job's assigned secondary admin (if any)
 *   - every active, non-deleted Admin
 *
 * Deliberately NOT ported: the original's `ALTER TABLE ... ADD COLUMN IF NOT
 * EXISTS` / `CREATE INDEX IF NOT EXISTS` schema guard. That existed to keep
 * *old* deployments (predating the deadline feature) working — here,
 * expected_completion_date is already a real Prisma-managed column
 * (`prisma/schema.prisma`), and its index is defined there too.
 *
 * Also does NOT write an audit_log entry, matching the original — this
 * function only ever touches `notifications`.
 *
 * Known gap vs. the original: the original's dedup guard is one atomic
 * SQL statement (`INSERT ... SELECT ... WHERE NOT EXISTS`). This version
 * does a read-then-write in application code, so two overlapping calls
 * (e.g. a manual trigger racing a scheduled one) could theoretically both
 * pass the "not already there" check before either writes and produce a
 * duplicate notification. Not expected to matter at this scale (the job
 * queue and notifications table are ID-indexed and duplicates are
 * harmless/cosmetic), but flagging rather than silently assuming it's fine.
 */
export async function syncRepairDeadlines(): Promise<SyncRepairDeadlinesResult> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const overdueJobs = await prisma.repairJob.findMany({
    where: {
      expectedCompletionDate: { lt: today },
      status: { not: "Delivered" },
    },
    select: {
      jobId: true,
      status: true,
      expectedCompletionDate: true,
      assignedTechnicianId: true,
      assignedSecondaryAdminId: true,
    },
  });

  if (overdueJobs.length === 0) {
    return { overdueJobsChecked: 0, notificationsCreated: 0 };
  }

  const activeAdmins = await prisma.user.findMany({
    where: { role: "Admin", isActive: true, deletedAt: null },
    select: { id: true },
  });
  const activeAdminIds = activeAdmins.map((a: { id: number }) => a.id);

  const jobIds = overdueJobs.map((j: { jobId: string }) => j.jobId);
  const existing = await prisma.notification.findMany({
    where: {
      notificationType: "repair_overdue",
      recordReference: { in: jobIds },
    },
    select: { recipientUserId: true, recordReference: true },
  });
  const existingPairs = new Set(
    existing.map((n: { recipientUserId: number; recordReference: string | null }) => `${n.recipientUserId}:${n.recordReference}`)
  );

  const toCreate: {
    recipientUserId: number;
    notificationType: string;
    title: string;
    message: string;
    recordReference: string;
  }[] = [];

  for (const job of overdueJobs) {
    if (!job.expectedCompletionDate) continue;

    const recipientIds = new Set<number>();
    if (job.assignedTechnicianId) recipientIds.add(job.assignedTechnicianId);
    if (job.assignedSecondaryAdminId) recipientIds.add(job.assignedSecondaryAdminId);
    for (const id of activeAdminIds) recipientIds.add(id);

    const message = `${job.jobId} was expected by ${formatOverdueDate(
      job.expectedCompletionDate
    )} and is still ${job.status}.`;

    for (const recipientId of recipientIds) {
      const key = `${recipientId}:${job.jobId}`;
      if (existingPairs.has(key)) continue;
      existingPairs.add(key); // guard against dupes within this same run too
      toCreate.push({
        recipientUserId: recipientId,
        notificationType: "repair_overdue",
        title: "Repair job overdue",
        message,
        recordReference: job.jobId,
      });
    }
  }

  if (toCreate.length === 0) {
    return { overdueJobsChecked: overdueJobs.length, notificationsCreated: 0 };
  }

  await prisma.notification.createMany({ data: toCreate });

  return { overdueJobsChecked: overdueJobs.length, notificationsCreated: toCreate.length };
}
