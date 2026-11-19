import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";
import { resolveReportedProblem } from "@/lib/reported-problems";

const EditDeviceSchema = z.object({
  title: z.string().default(""),
  customerName: z.string().trim().min(1).max(150),
  phoneNumber: z.string().trim().max(30),
  outlookEmail: z.string().trim(),
  givenByName: z.string().trim().min(1).max(150),
  aucAssetBarcode: z.string().trim().min(1).max(120),
  serialNumber: z.string().trim().min(1).max(150),
  macAddress: z.string().trim().max(50).optional().default(""),
  hostname: z.string().trim().max(255).optional().default(""),
  reportedProblemType: z.string().default(""),
  reportedProblemCustom: z.string().default(""),
  expectedCompletionDate: z.string().default(""),
  chargerReceived: z.boolean().default(false),
  networkCableBarcode: z.string().trim().default(""),
  bagReceived: z.boolean().default(false),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  let session;
  try {
    session = await requireApiRoles(["Admin", "Reception", "Technician"]);
  } catch (e) {
    return apiAuthErrorResponse(e)!;
  }

  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId) || deviceId < 1) {
    return NextResponse.json({ error: "Invalid device record." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = EditDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please correct the highlighted fields." }, { status: 400 });
  }
  const data = parsed.data;
  const reportedProblem = resolveReportedProblem(data.reportedProblemType, data.reportedProblemCustom);
  if (reportedProblem === "" || reportedProblem.length > 5000) {
    return NextResponse.json({ error: "Please enter a valid reported problem." }, { status: 400 });
  }
  if (data.title && !["Mr", "Ms"].includes(data.title)) {
    return NextResponse.json({ error: "Please select a valid customer title." }, { status: 400 });
  }
  if (data.outlookEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.outlookEmail)) {
    return NextResponse.json({ error: "Please enter a valid Outlook email address." }, { status: 400 });
  }
  const phoneDigits = data.phoneNumber.replace(/\D/g, "");
  if (data.phoneNumber && phoneDigits.length < 7) {
    return NextResponse.json({ error: "Please enter a valid customer phone number." }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      const isTechnician = session.role === "Technician";
      const job = await tx.repairJob.findUnique({
        where: { id: deviceId },
        include: { customer: true, accessories: true },
      });
      if (!job) throw new Error("The device record no longer exists.");

      // Duplicate check excluding this device.
      const duplicate = await tx.repairJob.findFirst({
        where: {
          id: { not: deviceId },
          OR: [
            { aucAssetBarcode: { equals: data.aucAssetBarcode, mode: "insensitive" } },
            { serialNumber: { equals: data.serialNumber, mode: "insensitive" } },
          ],
        },
      });
      if (duplicate) throw new Error("Another device already uses this AUC barcode or serial number.");

      const changedFields: string[] = [];
      if (job.customer.title !== (data.title || null)) changedFields.push("title");
      if (job.customer.fullName !== data.customerName) changedFields.push("customer_name");
      if (job.customer.phoneNumber !== data.phoneNumber) changedFields.push("phone_number");
      if (job.customer.outlookEmail !== data.outlookEmail) changedFields.push("outlook_email");
      if (job.givenByName !== data.givenByName) changedFields.push("given_by_name");
      if (job.aucAssetBarcode !== data.aucAssetBarcode) changedFields.push("auc_asset_barcode");
      if (job.serialNumber !== data.serialNumber) changedFields.push("serial_number");
      if ((job.macAddress ?? "") !== data.macAddress) changedFields.push("mac_address");
      if ((job.hostname ?? "") !== data.hostname) changedFields.push("hostname");
      if (job.reportedProblem !== reportedProblem) changedFields.push("reported_problem");
      if (job.accessories?.chargerReceived !== data.chargerReceived) changedFields.push("charger_received");
      if (job.accessories?.bagReceived !== data.bagReceived) changedFields.push("bag_received");

      if (changedFields.length === 0) {
        return { noChanges: true };
      }

      await tx.customer.update({
        where: { id: job.customerId },
        data: {
          title: data.title || null,
          fullName: data.customerName,
          phoneNumber: data.phoneNumber,
          outlookEmail: data.outlookEmail,
        },
      });

      await tx.repairJob.update({
        where: { id: deviceId },
        data: {
          aucAssetBarcode: data.aucAssetBarcode,
          serialNumber: data.serialNumber,
          macAddress: data.macAddress || null,
          hostname: data.hostname || null,
          reportedProblem,
          expectedCompletionDate: data.expectedCompletionDate ? new Date(data.expectedCompletionDate) : null,
          givenByName: data.givenByName,
        },
      });

      if (job.accessories) {
        await tx.accessories.update({
          where: { repairJobId: deviceId },
          data: {
            chargerReceived: data.chargerReceived,
            chargerReturned: data.chargerReceived ? undefined : false,
            networkCableBarcode: data.networkCableBarcode || null,
            networkCableReturned: data.networkCableBarcode ? undefined : false,
            bagReceived: data.bagReceived,
            bagReturned: data.bagReceived ? undefined : false,
          },
        });
      } else {
        await tx.accessories.create({
          data: {
            repairJobId: deviceId,
            chargerReceived: data.chargerReceived,
            networkCableBarcode: data.networkCableBarcode || null,
            bagReceived: data.bagReceived,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          performedBy: session.userId,
          actionType: "device_edited",
          recordType: "repair_job",
          recordId: job.id,
          recordReference: job.jobId,
          actionDetails: {
            changed_fields: changedFields,
            assigned_technician_id: job.assignedTechnicianId,
            edited_by_name: session.fullName,
            change_count: changedFields.length,
          },
          reason: "Customer, device, or received-accessory information was corrected.",
        },
      });

      if (isTechnician) {
        const admins = await tx.user.findMany({
          where: { role: "Admin", isActive: true, deletedAt: null },
          select: { id: true },
        });
        const assignment = job.assignedTechnicianId
          ? await tx.user.findUnique({ where: { id: job.assignedTechnicianId }, select: { fullName: true } })
          : null;
        const assignmentText = assignment ? `assigned to ${assignment.fullName}` : "unassigned";
        if (admins.length > 0) {
          await tx.notification.createMany({
            data: admins.map((a: { id: number }) => ({
              recipientUserId: a.id,
              createdBy: session.userId,
              notificationType: "technician_device_edit",
              title: "PC Details Edited",
              message: `PC ${job.jobId} was edited by ${session.fullName}. Assignment at the time: ${assignmentText}.`,
              recordReference: job.jobId,
            })),
          });
        }
      }

      return { noChanges: false, jobId: job.jobId };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The device could not be updated.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

const DeleteSchema = z.object({ reason: z.string().trim().min(10).max(500) });

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  let session;
  try {
    session = await requireApiRoles(["Admin", "Technician"]);
  } catch (e) {
    return apiAuthErrorResponse(e)!;
  }

  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId) || deviceId < 1) {
    return NextResponse.json({ error: "Invalid device record." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please provide a deletion reason between 10 and 500 characters." },
      { status: 400 },
    );
  }
  const { reason } = parsed.data;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      const isTechnician = session.role === "Technician";
      const job = await tx.repairJob.findUnique({ where: { id: deviceId } });
      if (!job) throw new Error("The selected device record is invalid.");

      await tx.auditLog.create({
        data: {
          performedBy: session.userId,
          actionType: "device_deleted",
          recordType: "repair_job",
          recordId: job.id,
          recordReference: job.jobId,
          actionDetails: {
            customer_id: job.customerId,
            auc_asset_barcode: job.aucAssetBarcode,
            serial_number: job.serialNumber,
            mac_address: job.macAddress,
            hostname: job.hostname,
            reported_problem: job.reportedProblem,
            status: job.status,
            assigned_technician_id: job.assignedTechnicianId,
            received_at: job.receivedAt,
          },
          reason,
        },
      });

      // Dependent operational records first; audit history is preserved.
      await tx.whatsappLog.deleteMany({ where: { repairJobId: deviceId } });
      await tx.receipt.deleteMany({ where: { repairJobId: deviceId } });
      await tx.statusHistory.deleteMany({ where: { repairJobId: deviceId } });
      await tx.accessories.deleteMany({ where: { repairJobId: deviceId } });
      await tx.repairJob.delete({ where: { id: deviceId } });

      // Remove the customer only if no other repair job still references it.
      const remainingJobs = await tx.repairJob.count({ where: { customerId: job.customerId } });
      if (remainingJobs === 0) {
        await tx.customer.delete({ where: { id: job.customerId } });
      }

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
              notificationType: "technician_device_deletion",
              title: "Device Deleted by Technician",
              message: `${session.fullName} permanently deleted device ${job.jobId}. Reason: ${reason}`,
              recordReference: job.jobId,
            })),
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The device could not be deleted.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
