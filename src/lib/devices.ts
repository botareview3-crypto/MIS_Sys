import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";

/** Mirrors the role-scoped WHERE clause used in view/edit/manage-devices.php. */
export async function loadDeviceForRole(deviceId: number, session: SessionPayload) {
  return prisma.repairJob.findFirst({
    where: {
      id: deviceId,
      ...(session.role === "Secondary Admin" ? { assignedSecondaryAdminId: session.userId } : {}),
    },
    include: {
      customer: true,
      accessories: true,
      technician: true,
      secondaryAdmin: true,
      acceptedByUser: true,
      statusHistory: { orderBy: { changedAt: "desc" }, include: { changedByUser: true } },
      receipts: { orderBy: { generatedAt: "desc" } },
      whatsappLogs: { orderBy: { preparedAt: "desc" } },
    },
  });
}
