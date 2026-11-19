import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";

const AssignSchema = z.object({
  technicianId: z.number().int().min(0),
  secondaryAdminId: z.number().int().min(0).nullable().default(null),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  let session;
  try {
    session = await requireApiRoles(["Admin"]);
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

  const body = await req.json().catch(() => null);
  const parsed = AssignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please select a valid technician option." }, { status: 400 });
  }
  const { technicianId, secondaryAdminId } = parsed.data;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      const job = await tx.repairJob.findUnique({
        where: { id: deviceId },
        include: { technician: true },
      });
      if (!job) throw new Error("The device record no longer exists.");

      let selectedTechnician = null;
      if (technicianId > 0) {
        selectedTechnician = await tx.user.findFirst({
          where: {
            id: technicianId,
            role: { in: ["Technician", "Admin"] },
            isActive: true,
            deletedAt: null,
          },
        });
        if (!selectedTechnician) throw new Error("The selected user is not a valid technician.");
      }

      let selectedSecondaryAdmin = null;
      if (secondaryAdminId) {
        selectedSecondaryAdmin = await tx.user.findFirst({
          where: { id: secondaryAdminId, role: "Admin", isMainAdmin: false, isActive: true, deletedAt: null },
        });
        if (!selectedSecondaryAdmin) throw new Error("The selected additional Admin is not valid.");
      }

      const previousTechnicianId = job.assignedTechnicianId;
      // A technician being assigned onto a still-"Received" device means
      // work is now clearly claimed and about to start, so the status
      // advances to Repairing right along with the assignment — same rule
      // for an Admin assigning someone here as for a Technician assigning
      // themselves (see /api/repairs/[id]/self-assign). Only fires when
      // status is still Received (an Admin reassigning a device that's
      // already Repairing/Ready/Delivered shouldn't roll it backwards).
      const willAutoAdvance = technicianId > 0 && job.status === "Received";

      await tx.repairJob.update({
        where: { id: deviceId },
        data: {
          assignedTechnicianId: technicianId > 0 ? technicianId : null,
          assignedSecondaryAdminId: secondaryAdminId || null,
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
            changeNote: `Status automatically advanced to Repairing after ${selectedTechnician?.fullName ?? "a technician"} was assigned.`,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          performedBy: session.userId,
          actionType: previousTechnicianId ? "technician_reassigned" : "technician_assigned",
          recordType: "repair_job",
          recordId: job.id,
          recordReference: job.jobId,
          actionDetails: {
            previous_technician_id: previousTechnicianId,
            previous_technician_name: job.technician?.fullName ?? null,
            new_technician_id: selectedTechnician?.id ?? null,
            new_technician_name: selectedTechnician?.fullName ?? null,
            new_technician_username: selectedTechnician?.username ?? null,
            secondary_admin_id: secondaryAdminId || null,
            secondary_admin_name: selectedSecondaryAdmin?.fullName ?? null,
            status_auto_advanced_to_repairing: willAutoAdvance,
          },
          reason: "Technician assignment updated by an administrator.",
        },
      });

      return { technicianName: selectedTechnician?.fullName ?? null, statusAutoAdvanced: willAutoAdvance };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The technician assignment could not be saved.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
