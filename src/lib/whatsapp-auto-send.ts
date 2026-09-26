/**
 * Automatic WhatsApp sending for the "Received" and "Ready" workflow
 * messages — no button click, no staff action. Called (fire-and-forget,
 * via `void`) from the device-registration route on create and from the
 * repair-status-update route when status changes to Ready.
 *
 * Never throws to the caller: a WhatsApp failure (disconnected session,
 * bad number, send error) must never fail device registration or a repair
 * status update.
 *
 * Deliberately does NOT write to `whatsapp_logs` (owner request,
 * 2026-09-26, session 22) — this just fires the message and forgets it.
 * Consequence: auto-sent Received/Ready messages will NOT show up in the
 * device's WhatsApp messages history section, unlike the manual "Prepared"
 * flow (whatsapp-message.php port), which still logs every time. Failures
 * (disconnected session, bad/missing number, send error) are only visible
 * in the server console log (`console.error` below), not in the app UI or
 * DB anywhere — there is currently no other record of a failed auto-send.
 */

import { prisma } from "@/lib/prisma";
import {
  buildDefaultWhatsappMessage,
  buildReceivedAccessoryText,
  buildReturnedAccessoryText,
  normalizePhoneForWhatsapp,
} from "@/lib/whatsapp";
import { sendWhatsappTextMessage } from "@/lib/whatsapp-client";

type AutoSendMessageType = "Received" | "Ready";

export async function autoSendWhatsappMessage(params: {
  repairJobId: number;
  messageType: AutoSendMessageType;
}): Promise<void> {
  try {
    const job = await prisma.repairJob.findUnique({
      where: { id: params.repairJobId },
      include: { customer: true, accessories: true },
    });
    if (!job) return;

    const normalizedPhone = normalizePhoneForWhatsapp(job.customer.phoneNumber);
    if (!normalizedPhone) {
      console.error(
        `Auto WhatsApp send skipped for job ${job.jobId}: no valid WhatsApp number on file.`,
      );
      return;
    }

    const message = buildDefaultWhatsappMessage(params.messageType, {
      customerName: job.customer.fullName,
      jobId: job.jobId,
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

    const result = await sendWhatsappTextMessage(normalizedPhone, message);

    if (!result.ok) {
      console.error(
        `Auto WhatsApp send failed for job ${job.jobId} (${params.messageType}): ${result.error}`,
      );
    }
  } catch (err) {
    // Last-resort guard — this function must never throw into a caller
    // that's in the middle of returning an unrelated HTTP response.
    console.error("Auto WhatsApp send failed:", err);
  }
}
