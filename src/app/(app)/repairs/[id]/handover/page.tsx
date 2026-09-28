import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  normalizePhoneForWhatsapp,
  buildReceivedAccessoryText,
  buildReturnedAccessoryText,
  buildDefaultWhatsappMessage,
} from "@/lib/whatsapp";
import { WhatsappMessageForm } from "@/components/devices/WhatsappMessageForm";
import { HandoverForm } from "@/components/receipts/HandoverForm";
import { PrintReceiptButton } from "@/components/receipts/PrintReceiptButton";

/**
 * Landing page after saving a repair as Delivered (see UpdateRepairForm).
 * Puts the two follow-up actions in one place:
 *   1. the Delivered WhatsApp message (same form/API as
 *      /devices/[id]/whatsapp?type=Delivered), and
 *   2. the customer-signed Equipment Handover Form (same document as the
 *      Delivery receipt at /receipts/[id]) with a Print button.
 *
 * Access: Admin, Reception, Technician — the intersection of what the
 * WhatsApp page and the receipt page allow (Secondary Admin has neither). A
 * Technician is scoped to jobs assigned to them, following the stricter of
 * the two (the receipt page's rule).
 */
export default async function HandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["Admin", "Reception", "Technician"].includes(session.role)) redirect("/dashboard");

  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId) || deviceId < 1) notFound();

  const job = await prisma.repairJob.findFirst({
    where: {
      id: deviceId,
      ...(session.role === "Technician" ? { assignedTechnicianId: session.userId } : {}),
    },
    include: { customer: true, accessories: true },
  });
  if (!job) notFound();

  const receipt = await prisma.receipt.findFirst({
    where: { repairJobId: job.id, receiptType: { equals: "Delivery", mode: "insensitive" } },
    orderBy: { id: "desc" },
    include: { creator: true },
  });

  const customerName = `${job.customer.title ?? ""} ${job.customer.fullName}`.trim();
  const isDelivered = job.status === "Delivered";
  const normalizedPhone = normalizePhoneForWhatsapp(job.customer.phoneNumber);

  let whatsappError = "";
  if (!isDelivered) {
    whatsappError = "The Delivered message is available only after delivery is completed.";
  } else if (!normalizedPhone) {
    whatsappError = "The customer phone number is not valid for WhatsApp.";
  }

  const defaultMessage = buildDefaultWhatsappMessage("Delivered", {
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
  });

  return (
    <main className="p-8">
      {/* Print only the handover form: hide everything else on the page
          (sidebar, top bar, WhatsApp section, buttons) via visibility so it
          works regardless of the surrounding layout. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #handover-print, #handover-print * { visibility: visible !important; }
          #handover-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Job {job.jobId}</p>
            <h1 className="text-lg font-semibold text-slate-900">Delivery follow-up</h1>
            <p className="mt-1 text-sm text-slate-500">
              {customerName}
              {job.hostname ? ` · ${job.hostname}` : ""}
            </p>
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

        {isDelivered && (
          <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Repair saved as Delivered. Send the WhatsApp message below, then print the handover form for the
            customer to sign.
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">1. WhatsApp message</h2>
          {whatsappError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {whatsappError}
            </div>
          )}
          <WhatsappMessageForm
            deviceId={job.id}
            messageType="Delivered"
            normalizedPhone={normalizedPhone}
            initialMessage={defaultMessage}
            disabled={!!whatsappError}
          />
        </section>

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
              {isDelivered
                ? "No delivery receipt exists for this job yet. Set the status to Repairing, save, then set it back to Delivered and save to generate it."
                : "The handover form is created when the job is saved as Delivered."}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
