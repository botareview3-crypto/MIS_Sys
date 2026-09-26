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

/**
 * Ported from app/pages/receipts/whatsapp-message.php. Lives inside the
 * `(app)` route group (shared sidebar) — unlike the receipt preview page,
 * the original includes `includes/sidebar.php`, so this is a normal
 * in-app screen, not a standalone printable one.
 *
 * Role check matches the original: Admin, Reception, Technician only
 * (Secondary Admin excluded). Deliberately NOT scoped to a Technician's own
 * assigned jobs — the original's SQL has no such WHERE clause here (unlike
 * receipt-preview.php, which does scope Technicians). Not "fixed"; carried
 * over exactly per CLAUDE.md.
 */
export default async function WhatsappMessagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!["Admin", "Reception", "Technician"].includes(session.role)) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId) || deviceId < 1) notFound();

  const { type } = await searchParams;
  const requestedType = (type ?? "Ready").trim();
  if (!isWhatsappMessageType(requestedType)) notFound();
  const messageType: WhatsappMessageType = requestedType;

  const job = await prisma.repairJob.findUnique({
    where: { id: deviceId },
    include: { customer: true, accessories: true },
  });

  if (!job) notFound();

  const customerName = `${job.customer.title ?? ""} ${job.customer.fullName}`.trim();
  const normalizedPhone = normalizePhoneForWhatsapp(job.customer.phoneNumber);

  let pageError = getWhatsappWorkflowError(messageType, job.status);
  if (!pageError && !normalizedPhone) {
    pageError = "The customer phone number is not valid for WhatsApp.";
  }

  // For "Ready": a customer with several devices in for repair should only
  // get one combined message once ALL of their devices are ready — never
  // one message per device as each individually finishes.
  let otherReadyHostnames: (string | null)[] | undefined;
  if (!pageError && messageType === "Ready") {
    const otherActiveDevices = await prisma.repairJob.findMany({
      where: { customerId: job.customerId, id: { not: job.id }, status: { not: "Delivered" } },
      select: { hostname: true, jobId: true, status: true },
    });

    const blockMessage = getMultiDeviceReadyBlockMessage(otherActiveDevices);
    if (blockMessage) {
      pageError = blockMessage;
    } else if (otherActiveDevices.length > 0) {
      otherReadyHostnames = otherActiveDevices.map((d) => d.hostname);
    }
  }

  const receivedAccessoryText = buildReceivedAccessoryText({
    chargerReceived: job.accessories?.chargerReceived ?? false,
    networkCableBarcode: job.accessories?.networkCableBarcode ?? null,
    bagReceived: job.accessories?.bagReceived ?? false,
  });
  const returnedAccessoryText = buildReturnedAccessoryText({
    chargerReturned: job.accessories?.chargerReturned ?? false,
    networkCableReturned: job.accessories?.networkCableReturned ?? false,
    bagReturned: job.accessories?.bagReturned ?? false,
  });

  const defaultMessage = buildDefaultWhatsappMessage(messageType, {
    customerName,
    hostname: job.hostname,
    receivedAt: job.receivedAt,
    deliveredAt: job.deliveredAt,
    receivedAccessoryText,
    returnedAccessoryText,
    otherReadyHostnames,
  });

  return (
    <main className="p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Job {job.jobId}</p>
            <h1 className="text-lg font-semibold text-slate-900">{messageType} WhatsApp Message</h1>
            <p className="mt-1 text-sm text-slate-500">{customerName}</p>
          </div>
          <Link href={`/devices/${job.id}`} className="btn-primary bg-slate-700 hover:bg-slate-800">
            ← Back to Device Details
          </Link>
        </div>

        {pageError && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {pageError}
          </div>
        )}

        <section className="card grid grid-cols-3 gap-4 p-5 text-sm">
          <div>
            <span className="block text-xs text-slate-400">Registered Phone</span>
            <strong className="text-slate-900">{job.customer.phoneNumber}</strong>
          </div>
          <div>
            <span className="block text-xs text-slate-400">WhatsApp Number</span>
            <strong className="text-slate-900">{normalizedPhone ? `+${normalizedPhone}` : "Invalid number"}</strong>
          </div>
          <div>
            <span className="block text-xs text-slate-400">Message Type</span>
            <strong className="text-slate-900">{messageType}</strong>
          </div>
        </section>

        <WhatsappMessageForm
          deviceId={job.id}
          messageType={messageType}
          normalizedPhone={normalizedPhone}
          initialMessage={defaultMessage}
          disabled={!!pageError}
        />
      </div>
    </main>
  );
}
