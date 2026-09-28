import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isWhatsappMessageType,
  getWhatsappWorkflowError,
  getMultiDeviceReadyBlockMessage,
  normalizePhoneForWhatsapp,
  buildReceivedAccessoryText,
  buildReturnedAccessoryText,
  buildDefaultWhatsappMessage,
  type WhatsappMessageType,
} from "@/lib/whatsapp";
import { WhatsappMessageForm } from "@/components/devices/WhatsappMessageForm";
import { HandoverForm } from "@/components/receipts/HandoverForm";
import { PrintReceiptButton } from "@/components/receipts/PrintReceiptButton";
import { deviceLabel } from "@/lib/device-label";

/**
 * Landing page after saving a repair as Received, Ready or Delivered (see
 * UpdateRepairForm). Keeps the follow-up actions off the edit form:
 *   - Received / Ready: the WhatsApp message for that status.
 *   - Delivered: the WhatsApp message, then the customer-signed Equipment
 *     Handover Form (same document as the Delivery receipt at
 *     /receipts/[id]) with a Print button.
 *
 * The message type comes from the job's saved status, not the URL, so the
 * page always matches what was just saved. A job in any other status
 * (Repairing) has no follow-up and goes back to the device page.
 *
 * Access: Admin, Reception, Technician — what the WhatsApp page allows
 * (Secondary Admin has no WhatsApp access). For Delivered, a Technician is
 * scoped to jobs assigned to them, following the receipt page's stricter rule.
 */
export default async function FollowUpPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["Admin", "Reception", "Technician"].includes(session.role)) redirect("/dashboard");

  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId) || deviceId < 1) notFound();

  const job = await prisma.repairJob.findUnique({
    where: { id: deviceId },
    include: { customer: true, accessories: true },
  });
  if (!job) notFound();

  if (!isWhatsappMessageType(job.status)) redirect(`/devices/${job.id}`);
  const messageType: WhatsappMessageType = job.status;
  const isDelivered = messageType === "Delivered";

  // Only Delivered shows the printable form, so only Delivered applies the
  // Technician-assigned scoping.
  if (isDelivered && session.role === "Technician" && job.assignedTechnicianId !== session.userId) notFound();

  const receipt = isDelivered
    ? await prisma.receipt.findFirst({
        where: { repairJobId: job.id, receiptType: { equals: "Delivery", mode: "insensitive" } },
        orderBy: { id: "desc" },
        include: { creator: true },
      })
    : null;

  const customerName = `${job.customer.title ?? ""} ${job.customer.fullName}`.trim();
  const normalizedPhone = normalizePhoneForWhatsapp(job.customer.phoneNumber);

  let whatsappError = getWhatsappWorkflowError(messageType, job.status);
  if (!whatsappError && !normalizedPhone) {
    whatsappError = "The customer phone number is not valid for WhatsApp.";
  }

  // Ready: a customer with several devices in for repair gets one combined
  // message once ALL of them are ready (same rule as /devices/[id]/whatsapp).
  let otherReadyHostnames: (string | null)[] | undefined;
  if (!whatsappError && messageType === "Ready") {
    const otherActiveDevices = await prisma.repairJob.findMany({
      where: { customerId: job.customerId, id: { not: job.id }, status: { not: "Delivered" } },
      select: { hostname: true, jobId: true, status: true },
    });
    const blockMessage = getMultiDeviceReadyBlockMessage(otherActiveDevices);
    if (blockMessage) {
      whatsappError = blockMessage;
    } else if (otherActiveDevices.length > 0) {
      otherReadyHostnames = otherActiveDevices.map((d) => d.hostname);
    }
  }

  const defaultMessage = buildDefaultWhatsappMessage(messageType, {
    customerName,
    hostname: job.hostname,
    receivedAt: job.receivedAt,
    deliveredAt: job.deliveredAt,
    receivedAccessoryText: buildReceivedAccessoryText({
      chargerReceived: job.accessories?.chargerReceived ?? false,
      networkCableBarcode: job.accessories?.networkCableBarcode ?? null,
      bagReceived: job.accessories?.bagReceived ?? false,
    }),
    returnedAccessoryText: buildReturnedAccessoryText({
      chargerReturned: job.accessories?.chargerReturned ?? false,
      networkCableReturned: job.accessories?.networkCableReturned ?? false,
      bagReturned: job.accessories?.bagReturned ?? false,
    }),
    otherReadyHostnames,
  });

  return (
    <main className="p-8">
      {/* Print only the handover form: hide everything else on the page
          (sidebar, top bar, WhatsApp section, buttons) via visibility so it
          works regardless of the surrounding layout. */}
      {isDelivered && (
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #handover-print, #handover-print * { visibility: visible !important; }
            #handover-print { position: absolute; left: 0; top: 0; width: 100%; }
          }
        `}</style>
      )}

      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{deviceLabel(job.hostname)}</p>
            <h1 className="text-lg font-semibold text-slate-900">{messageType} follow-up</h1>
            <p className="mt-1 text-sm text-slate-500">{customerName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={`/devices/${job.id}`} className="btn-primary bg-slate-700 hover:bg-slate-800">
              Device details
            </Link>
            <Link href="/work-queue" className="btn-primary bg-slate-700 hover:bg-slate-800">
              Work queue
            </Link>
          </div>
        </div>

        <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Repair saved as {messageType}.{" "}
          {isDelivered
            ? "Send the WhatsApp message below, then print the handover form for the customer to sign."
            : "Send the WhatsApp message below to let the customer know."}
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {isDelivered ? "1. WhatsApp message" : "WhatsApp message"}
          </h2>
          {whatsappError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {whatsappError}
            </div>
          )}
          <WhatsappMessageForm
            deviceId={job.id}
            messageType={messageType}
            normalizedPhone={normalizedPhone}
            initialMessage={defaultMessage}
            disabled={!!whatsappError}
          />
        </section>

        {isDelivered && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold text-slate-900">2. Handover form (for signature)</h2>
              {receipt && (
                <PrintReceiptButton
                  receiptId={receipt.id}
                  initialPrintCount={receipt.printCount}
                  baseLabel="Print Handover Form"
                />
              )}
            </div>

            {receipt ? (
              <div id="handover-print">
                <HandoverForm
                  job={job}
                  receipt={{
                    receiptReference: receipt.receiptReference,
                    generatedAt: receipt.generatedAt,
                    creatorName: receipt.creator?.fullName ?? null,
                  }}
                />
              </div>
            ) : (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                No delivery receipt exists for this job yet. Set the status to Repairing, save, then set it back to
                Delivered and save to generate it.
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
