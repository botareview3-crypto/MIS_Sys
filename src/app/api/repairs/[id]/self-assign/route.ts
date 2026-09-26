import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<{ id: string }> };

/**
 * Lets a Technician claim a device that isn't formally assigned to anyone
 * yet — the counterpart to /api/repairs/[id]/assign, which is Admin-only
 * and can assign *any* technician to *any* device. This route only ever
 * assigns the caller to themselves, and only when the device has no
 * assignedTechnicianId already, so a technician can never grab a job away
 * from someone else this way.
 *
 * Registering a device (POST /api/devices/register) deliberately leaves
 * assignedTechnicianId blank even when a Technician does the registering
 * (see that route's `isTechnician ? "" : ...` — registering ≠ being
 * assigned). This is the explicit "yes, this is my job" action that was
 * missing: it's what actually sets assignedTechnicianId, and — same rule
 * as the Admin assign route — advances a still-"Received" device straight
 * to "Repairing", since claiming a job means work is starting.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  let session;
  try {
    session = await requireApiRoles(["Technician"]);
  } catch (e) {
    const authError = apiAuthErrorResponse(e);
    if (authError) return authError;
    throw e;
  }

  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId) || deviceId < 1) {
    return NextResponse.json({ error: "Invalid device record." }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      const job = await tx.repairJob.findUnique({
        where: { id: deviceId },
        include: { technician: true },
      });
      if (!job) throw new Error("The device record no longer exists.");

      if (job.assignedTechnicianId === session.userId) {
        return { noChanges: true, statusAutoAdvanced: false };
      }
      if (job.assignedTechnicianId !== null) {
        throw new Error(`This device is already assigned to ${job.technician?.fullName ?? "another technician"}.`);
      }
      if (job.status === "Delivered") {
        throw new Error("This device has already been delivered.");
      }

      const willAutoAdvance = job.status === "Received";

      await tx.repairJob.update({
        where: { id: deviceId },
        data: {
          assignedTechnicianId: session.userId,
          ...(willAutoAdvance ? { status: "Repairing" } : {}),
        },
      });

      if (willAutoAdvance) {
        await tx.statusHistory.create({
          data: {
            repairJobId: deviceId,
            previousStatus: job.status,
            newStatus: "Repairing",
            changedBy: session.userId,
            changeNote: `Status automatically advanced to Repairing after ${session.fullName} self-assigned.`,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          performedBy: session.userId,
          actionType: "technician_self_assigned",
          recordType: "repair_job",
          recordId: job.id,
          recordReference: job.jobId,
          actionDetails: {
            technician_id: session.userId,
            technician_name: session.fullName,
            status_auto_advanced_to_repairing: willAutoAdvance,
          },
          reason: "Technician claimed an unassigned device as their own.",
        },
      });

      return { noChanges: false, statusAutoAdvanced: willAutoAdvance };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The device could not be assigned to you.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
