import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";

const BulkAssignSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
  technicianId: z.number().int().min(0),
  secondaryAdminId: z.number().int().min(0).nullable().default(null),
});

/**
 * Bulk technician/secondary-admin reassignment for the Work Queue's
 * multi-select actions. Admin-only, same as the single-job
 * PATCH /api/repairs/[id]/assign — no new permission path, just the same
 * check applied once per selected job. Per-job behavior (auto-advance
 * Received → Repairing when a technician is newly assigned, audit log
 * entry, status history row when it auto-advances) mirrors that route
 * exactly.
 */
export async function PATCH(req: NextRequest) {
  let session;
  try {
    session = await requireApiRoles(["Admin"]);
  } catch (e) {
    const authError = apiAuthErrorResponse(e);
    if (authError) return authError;
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = BulkAssignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please select at least one job and a valid technician option." }, { status: 400 });
  }
  const { ids, technicianId, secondaryAdminId } = parsed.data;
  const uniqueIds = [...new Set(ids)];

  const updated: number[] = [];
  const skipped: { id: number; reason: string }[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      let selectedTechnician = null;
      if (technicianId > 0) {
        selectedTechnician = await tx.user.findFirst({
          where: { id: technicianId, role: { in: ["Technician", "Admin"] }, isActive: true, deletedAt: null },
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

      for (const id of uniqueIds) {
        const job = await tx.repairJob.findUnique({ where: { id }, include: { technician: true } });
        if (!job) {
          skipped.push({ id, reason: "Device record no longer exists." });
          continue;
        }

        const previousTechnicianId = job.assignedTechnicianId;
        const willAutoAdvance = technicianId > 0 && job.status === "Received";

        await tx.repairJob.update({
          where: { id },
          data: {
            assignedTechnicianId: technicianId > 0 ? technicianId : null,
            assignedSecondaryAdminId: secondaryAdminId || null,
            ...(willAutoAdvance ? { status: "Repairing" } : {}),
          },
        });

        if (willAutoAdvance) {
          await tx.statusHistory.create({
            data: {
              repairJobId: id,
              previousStatus: job.status,
              newStatus: "Repairing",
              changedBy: session.userId,
              changeNote: `Status automatically advanced to Repairing after ${selectedTechnician?.fullName ?? "a technician"} was assigned (bulk action).`,
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
              bulk: true,
            },
            reason: "Technician assignment updated by an administrator via Work Queue bulk action.",
          },
        });

        updated.push(id);
      }

      return { technicianName: selectedTechnician?.fullName ?? null };
    });

    return NextResponse.json({ ok: true, updated, skipped, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The bulk technician assignment could not be saved.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
