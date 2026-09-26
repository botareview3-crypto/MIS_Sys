import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";
import { validExpectedCompletionDate } from "@/lib/repair-deadlines";
import { autoSendWhatsappMessage } from "@/lib/whatsapp-auto-send";

const STATUSES = ["Received", "Repairing", "Ready", "Delivered"] as const;

const UpdateRepairSchema = z.object({
  technicianDiagnosis: z.string().trim().max(5000).default(""),
  repairNotes: z.string().trim().max(10000).default(""),
  status: z.enum(STATUSES),
  changeNote: z.string().trim().max(500).default(""),
  expectedCompletionDate: z.string().default(""),
  chargerReturned: z.boolean().default(false),
  networkCableReturned: z.boolean().default(false),
  bagReturned: z.boolean().default(false),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  let session;
  try {
    session = await requireApiRoles(["Admin", "Secondary Admin", "Technician"]);
  } catch (e) {
    const authError = apiAuthErrorResponse(e);
    if (authError) return authError;
    throw e;
  }

  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId) || deviceId < 1) {
    return NextResponse.json({ error: "Invalid repair record." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = UpdateRepairSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please select a valid repair status." }, { status: 400 });
  }
  const data = parsed.data;
  if (!validExpectedCompletionDate(data.expectedCompletionDate)) {
    return NextResponse.json({ error: "Please enter a valid expected completion date." }, { status: 400 });
  }

  const isTechnician = session.role === "Technician";
  const isSecondaryAdmin = session.role === "Secondary Admin";
  const requiresAssignment = isSecondaryAdmin;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      const job = await tx.repairJob.findFirst({
        where: {
          id: deviceId,
          ...(requiresAssignment ? { assignedSecondaryAdminId: session.userId } : {}),
        },
        include: { accessories: true },
      });
      if (!job) throw new Error("The repair record no longer exists, or access was denied.");

      const previousStatus = job.status;
      const diagnosisChanged = (job.technicianDiagnosis ?? "") !== data.technicianDiagnosis;
      const repairNotesChanged = (job.repairNotes ?? "") !== data.repairNotes;
      const statusChanged = previousStatus !== data.status;
      const previousDeadline = job.expectedCompletionDate ? job.expectedCompletionDate.toISOString().slice(0, 10) : "";
      const deadlineChanged = previousDeadline !== data.expectedCompletionDate;

      const chargerReceived = job.accessories?.chargerReceived ?? false;
      const networkCableReceived = !!job.accessories?.networkCableBarcode;
      const bagReceived = job.accessories?.bagReceived ?? false;

      const chargerReturned = chargerReceived && data.chargerReturned;
      const networkCableReturned = networkCableReceived && data.networkCableReturned;
      const bagReturned = bagReceived && data.bagReturned;

      const accessoryReturnsChanged =
        chargerReturned !== (job.accessories?.chargerReturned ?? false) ||
        networkCableReturned !== (job.accessories?.networkCableReturned ?? false) ||
        bagReturned !== (job.accessories?.bagReturned ?? false);

      if (!diagnosisChanged && !repairNotesChanged && !statusChanged && !deadlineChanged && !accessoryReturnsChanged) {
        return { noChanges: true };
      }

      if (job.accessories) {
        await tx.accessories.update({
          where: { repairJobId: deviceId },
          data: { chargerReturned, networkCableReturned, bagReturned },
        });
      }

      await tx.repairJob.update({
        where: { id: deviceId },
        data: {
          technicianDiagnosis: data.technicianDiagnosis,
          repairNotes: data.repairNotes,
          status: data.status,
          expectedCompletionDate: data.expectedCompletionDate ? new Date(data.expectedCompletionDate) : null,
          readyAt: ["Ready", "Delivered"].includes(data.status) ? (job.readyAt ?? new Date()) : null,
          deliveredAt: data.status === "Delivered" ? (job.deliveredAt ?? new Date()) : null,
        },
      });

      let changeNote = data.changeNote;
      if (statusChanged) {
        if (changeNote === "") {
          changeNote = `Status updated from ${previousStatus} to ${data.status}.`;
        }
        await tx.statusHistory.create({
          data: {
            repairJobId: deviceId,
            previousStatus,
            newStatus: data.status,
            changedBy: session.userId,
            changeNote,
          },
        });
      }

      let workflowReceiptType: "Ready" | "Delivery" | null = null;
      let workflowReceiptReference: string | null = null;

      if (statusChanged && (data.status === "Ready" || data.status === "Delivered")) {
        workflowReceiptType = data.status === "Ready" ? "Ready" : "Delivery";
        const existingReceipt = await tx.receipt.findFirst({
          where: { repairJobId: deviceId, receiptType: { equals: workflowReceiptType, mode: "insensitive" } },
          orderBy: { id: "desc" },
        });
        if (existingReceipt) {
          workflowReceiptReference = existingReceipt.receiptReference;
        } else {
          const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
          workflowReceiptReference = `REC-${today}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
          await tx.receipt.create({
            data: {
              repairJobId: deviceId,
              receiptType: workflowReceiptType,
              receiptReference: workflowReceiptReference,
              createdBy: session.userId,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          performedBy: session.userId,
          actionType: "repair_updated",
          recordType: "repair_job",
          recordId: job.id,
          recordReference: job.jobId,
          actionDetails: {
            assigned_technician_id: job.assignedTechnicianId,
            updated_by_name: session.fullName,
            previous_status: previousStatus,
            new_status: data.status,
            status_changed: statusChanged,
            diagnosis_changed: diagnosisChanged,
            repair_notes_changed: repairNotesChanged,
            deadline_changed: deadlineChanged,
            expected_completion_date: data.expectedCompletionDate || null,
            status_change_note: statusChanged ? changeNote : null,
            accessory_returns_changed: accessoryReturnsChanged,
            charger_returned: chargerReturned,
            network_cable_returned: networkCableReturned,
            bag_returned: bagReturned,
          },
          reason: "Repair information updated from the technician work queue.",
        },
      });

      if (isTechnician) {
        const admins = await tx.user.findMany({
          where: { role: "Admin", isActive: true, deletedAt: null },
          select: { id: true },
        });
        if (admins.length > 0) {
          await tx.notification.createMany({
            data: admins.map((a: { id: number }) => ({
              recipientUserId: a.id,
              createdBy: session.userId,
              notificationType: "technician_repair_update",
              title: "Repair Updated by Technician",
              message: `${session.fullName} updated repair ${job.jobId} (${previousStatus} → ${data.status}).`,
              recordReference: job.jobId,
            })),
          });
        }
      }

      return { noChanges: false, workflowReceiptType, workflowReceiptReference, statusChanged, newStatus: data.status };
    });

    // Fire-and-forget: auto-send the "Ready" WhatsApp notification, only
    // when status just changed TO Ready (not on every edit while it stays
    // Ready). Same non-blocking, never-throws pattern as registration.
    if (!result.noChanges && result.statusChanged && result.newStatus === "Ready") {
      void autoSendWhatsappMessage({ repairJobId: deviceId, messageType: "Ready" });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The repair update could not be saved.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
