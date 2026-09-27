import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";

// Same four statuses the single-job PATCH /api/repairs/[id] route accepts
// (src/app/api/repairs/[id]/route.ts) — "Diagnosing" is a valid value in
// the DB CHECK constraint and shows up in StatusBadge/the login legend,
// but no existing status-change path (this one included) currently offers
// it as a target. Flagged to the project owner rather than silently
// widened here; kept in lockstep with the single-job route on purpose.
const STATUSES = ["Received", "Repairing", "Ready", "Delivered"] as const;

const BulkStatusSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
  status: z.enum(STATUSES),
  changeNote: z.string().trim().max(500).default(""),
});

/**
 * Bulk status change for the Work Queue's multi-select actions (and reused
 * by the Kanban drag-and-drop status change). Deliberately a separate,
 * status-only endpoint rather than reusing PATCH /api/repairs/[id] as-is:
 * that route's schema requires a full diagnosis/notes/accessories payload
 * per job, which a multi-select action doesn't have per-job values for.
 * This endpoint mirrors that route's role/ownership rules and writes the
 * same kind of StatusHistory + Receipt + AuditLog records for each job it
 * touches — it does not open any access this route's single-job sibling
 * doesn't already allow.
 */
export async function PATCH(req: NextRequest) {
  let session;
  try {
    session = await requireApiRoles(["Admin", "Secondary Admin", "Technician"]);
  } catch (e) {
    const authError = apiAuthErrorResponse(e);
    if (authError) return authError;
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = BulkStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please select at least one job and a valid status." }, { status: 400 });
  }
  const { ids, status, changeNote } = parsed.data;
  const uniqueIds = [...new Set(ids)];

  const isSecondaryAdmin = session.role === "Secondary Admin";
  const isTechnician = session.role === "Technician";

  const updated: number[] = [];
  const skipped: { id: number; reason: string }[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      for (const id of uniqueIds) {
        const job = await tx.repairJob.findFirst({
          where: {
            id,
            // Same ownership restriction as the single-job route: only
            // Secondary Admin is scoped to their own assigned jobs.
            ...(isSecondaryAdmin ? { assignedSecondaryAdminId: session.userId } : {}),
          },
        });
        if (!job) {
          skipped.push({ id, reason: "Not found, or access denied." });
          continue;
        }
        if (job.status === status) {
          skipped.push({ id, reason: `Already ${status}.` });
          continue;
        }

        const previousStatus = job.status;

        await tx.repairJob.update({
          where: { id },
          data: {
            status,
            readyAt: ["Ready", "Delivered"].includes(status) ? (job.readyAt ?? new Date()) : null,
            deliveredAt: status === "Delivered" ? (job.deliveredAt ?? new Date()) : null,
          },
        });

        const note = changeNote || `Status updated from ${previousStatus} to ${status} (bulk action).`;
        await tx.statusHistory.create({
          data: { repairJobId: id, previousStatus, newStatus: status, changedBy: session.userId, changeNote: note },
        });

        // Same auto-receipt behavior as the single-job route: ensure a
        // Ready/Delivery receipt exists once a job reaches that status,
        // reusing one if it's already there instead of duplicating.
        if (status === "Ready" || status === "Delivered") {
          const receiptType = status === "Ready" ? "Ready" : "Delivery";
          const existingReceipt = await tx.receipt.findFirst({
            where: { repairJobId: id, receiptType: { equals: receiptType, mode: "insensitive" } },
            orderBy: { id: "desc" },
          });
          if (!existingReceipt) {
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
            await tx.receipt.create({
              data: {
                repairJobId: id,
                receiptType,
                receiptReference: `REC-${today}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
                createdBy: session.userId,
              },
            });
          }
        }

        await tx.auditLog.create({
          data: {
            performedBy: session.userId,
            actionType: "repair_status_bulk_updated",
            recordType: "repair_job",
            recordId: id,
            recordReference: job.jobId,
            actionDetails: {
              previous_status: previousStatus,
              new_status: status,
              status_change_note: note,
              bulk: true,
            },
            reason: "Status changed via Work Queue bulk action.",
          },
        });

        if (isTechnician) {
          const admins = await tx.user.findMany({
            where: { role: "Admin", isActive: true, deletedAt: null },
            select: { id: true },
          });
          if (admins.length > 0) {
            await tx.notification.createMany({
              data: admins.map((a) => ({
                recipientUserId: a.id,
                createdBy: session.userId,
                notificationType: "technician_repair_update",
                title: "Repair Updated by Technician",
                message: `${session.fullName} updated repair ${job.jobId} (${previousStatus} → ${status}).`,
                recordReference: job.jobId,
              })),
            });
          }
        }

        updated.push(id);
      }
    });

    return NextResponse.json({ ok: true, updated, skipped });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The bulk status change could not be saved.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
