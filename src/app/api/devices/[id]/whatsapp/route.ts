import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";
import { isMyJob } from "@/lib/my-jobs";
import {
  isWhatsappMessageType,
  getWhatsappWorkflowError,
  getMultiDeviceReadyBlockMessage,
  normalizePhoneForWhatsapp,
  buildWhatsappUrl,
  WHATSAPP_FORBIDDEN_CONTENT,
} from "@/lib/whatsapp";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<{ id: string }> };

/**
 * Ported from the POST branch of app/pages/receipts/whatsapp-message.php.
 * Re-validates everything server-side (never trusts the client-computed
 * phone number or workflow state), logs the prepared message to
 * `whatsapp_logs`, writes an audit log entry, and returns the `wa.me` URL
 * for the client to navigate to — replacing the original's server-side
 * redirect.
 *
 * Role check matches the original: Admin, Reception, Technician (Secondary
 * Admin excluded). Not scoped to a Technician's own assigned jobs, same as
 * the page — see that page's comment for why this is intentional, not an
 * oversight.
 *
 * No CSRF token — same established decision as every other mutating route
 * in this codebase (docs/status.md deviation #3).
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  let session;
  try {
    session = await requireApiRoles(["Admin", "Reception", "Technician"]);
  } catch (e) {
    const authError = apiAuthErrorResponse(e);
    if (authError) return authError;
    throw e;
  }

  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId) || deviceId < 1) {
    return NextResponse.json({ success: false, message: "Invalid repair record." }, { status: 400 });
  }

  let body: { messageType?: string; generatedMessage?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body." }, { status: 400 });
  }

  const messageType = (body.messageType ?? "").trim();
  const submittedMessage = (body.generatedMessage ?? "").trim();

  if (!isWhatsappMessageType(messageType)) {
    return NextResponse.json(
      { success: false, message: "The selected WhatsApp message type is invalid." },
      { status: 422 },
    );
  }

  const job = await prisma.repairJob.findUnique({
    where: { id: deviceId },
    include: { customer: true },
  });

  if (!job) {
    return NextResponse.json(
      { success: false, message: "Repair record not found, or access was denied." },
      { status: 404 },
    );
  }

  const workflowError = getWhatsappWorkflowError(messageType, job.status);
  if (workflowError) {
    return NextResponse.json({ success: false, message: workflowError }, { status: 422 });
  }

  // Same multi-device guard as the page: never let a "Ready" message go out
  // while the customer has other devices still in progress, even if the
  // client-side check was somehow bypassed.
  if (messageType === "Ready") {
    const otherActiveDevices = await prisma.repairJob.findMany({
      where: { customerId: job.customerId, id: { not: job.id }, status: { not: "Delivered" } },
      select: { hostname: true, jobId: true, status: true },
    });
    const multiDeviceBlock = getMultiDeviceReadyBlockMessage(otherActiveDevices);
    if (multiDeviceBlock) {
      return NextResponse.json({ success: false, message: multiDeviceBlock }, { status: 422 });
    }
  }

  const normalizedPhone = normalizePhoneForWhatsapp(job.customer.phoneNumber);
  if (!normalizedPhone) {
    return NextResponse.json(
      { success: false, message: "A valid WhatsApp phone number is required." },
      { status: 422 },
    );
  }

  if (submittedMessage.length < 10) {
    return NextResponse.json(
      { success: false, message: "Please enter a complete customer message." },
      { status: 422 },
    );
  }
  if (submittedMessage.length > 2000) {
    return NextResponse.json(
      { success: false, message: "The WhatsApp message cannot exceed 2,000 characters." },
      { status: 422 },
    );
  }
  if (WHATSAPP_FORBIDDEN_CONTENT.test(submittedMessage)) {
    return NextResponse.json(
      {
        success: false,
        message: "Passwords, verification codes, and other credentials cannot be included in customer messages.",
      },
      { status: 422 },
    );
  }

  // A Technician sending their own job's "Received" message has, in effect,
  // told the customer their device is now being worked on — so the status
  // auto-advances to Repairing right here instead of making them find the
  // separate Update Status screen. Scoped to Technician + their own job
  // (see isMyJob — acceptedBy or assignedTechnicianId) so this never fires
  // for Admin/Reception sending on someone else's behalf, or for a
  // Technician sending on a job that isn't theirs; those cases still use
  // the manual "Update Status" action (always available to Admin, and to
  // Secondary Admin/Technician on their own jobs — see /devices/[id]).
  const shouldAutoAdvanceToRepairing =
    messageType === "Received" &&
    job.status === "Received" &&
    session.role === "Technician" &&
    isMyJob(job, session.userId);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whatsappLog = await prisma.$transaction(async (tx: any) => {
      const log = await tx.whatsappLog.create({
        data: {
          repairJobId: job.id,
          messageType,
          recipientNumber: normalizedPhone,
          generatedMessage: submittedMessage,
          messageStatus: "Prepared",
          preparedBy: session.userId,
        },
      });

      if (shouldAutoAdvanceToRepairing) {
        await tx.repairJob.update({ where: { id: job.id }, data: { status: "Repairing" } });
        await tx.statusHistory.create({
          data: {
            repairJobId: job.id,
            previousStatus: job.status,
            newStatus: "Repairing",
            changedBy: session.userId,
            changeNote: "Status automatically advanced to Repairing after the Received WhatsApp message was sent.",
          },
        });
      }

      return log;
    });

    const ipAddress = req.headers.get("x-forwarded-for") ?? "unknown";
    try {
      await prisma.auditLog.create({
        data: {
          performedBy: session.userId,
          actionType: "whatsapp_message_prepared",
          recordType: "whatsapp_log",
          recordId: whatsappLog.id,
          recordReference: job.jobId,
          actionDetails: {
            whatsappLogId: whatsappLog.id,
            messageType,
            recipientNumber: normalizedPhone,
            messageStatus: "Prepared",
            messageLength: submittedMessage.length,
            statusAutoAdvancedToRepairing: shouldAutoAdvanceToRepairing,
          },
          reason: "Customer WhatsApp message prepared for staff review.",
          ipAddress,
        },
      });
    } catch (auditError) {
      console.error("WhatsApp message audit log failed:", auditError);
    }

    return NextResponse.json({
      success: true,
      whatsappUrl: buildWhatsappUrl(normalizedPhone, submittedMessage),
      statusAutoAdvancedToRepairing: shouldAutoAdvanceToRepairing,
    });
  } catch (err) {
    console.error("WhatsApp message preparation failed:", err);
    return NextResponse.json(
      { success: false, message: "The WhatsApp message could not be prepared. Please try again." },
      { status: 500 },
    );
  }
}
