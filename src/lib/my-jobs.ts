import { prisma } from "@/lib/prisma";

/**
 * "My jobs" for the personalized dashboard (2026-09-26): a job counts as
 * someone's own if they registered it (acceptedBy — set to whoever ran the
 * registration flow, see src/app/api/devices/register/route.ts) OR it's
 * been assigned to them as technician or secondary admin. This covers both
 * cases the project owner described: a technician who self-registers and
 * works a device end-to-end, and one who gets a device handed to them by
 * someone else (Reception/Admin) to work on.
 */
export function myJobsWhere(userId: number) {
  return {
    OR: [{ acceptedBy: userId }, { assignedTechnicianId: userId }, { assignedSecondaryAdminId: userId }],
  };
}

export const STATUS_KEYS = ["Received", "Repairing", "Ready", "Delivered"] as const;

export async function getMyDashboardData(userId: number) {
  const where = myJobsWhere(userId);

  const [counts, jobs] = await Promise.all([
    prisma.repairJob.groupBy({ by: ["status"], where, _count: { status: true } }),
    prisma.repairJob.findMany({
      where,
      include: { customer: { select: { fullName: true } } },
      orderBy: [{ receivedAt: "desc" }],
      take: 8,
    }),
  ]);

  const statusCounts: Record<string, number> = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0]));
  for (const row of counts) statusCounts[row.status] = row._count.status;
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  return { statusCounts, total, jobs };
}
