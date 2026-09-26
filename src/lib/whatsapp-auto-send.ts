/**
 * Automatic WhatsApp sending for the "Received" and "Ready" workflow
 * messages — no button click, no staff action. Called (fire-and-forget,
 * via `void`) from the device-registration route on create and from the
 * repair-status-update route when status changes to Ready.
 *
 * Never throws to the caller: a WhatsApp failure (disconnected session,
 * bad number, send error) must never fail device registration or a repair
 * status update. Every attempt is logged to `whatsapp_logs` regardless of
 * outcome, so it still shows up in the device's WhatsApp messages section
 * — `messageStatus` is "Sent" or "Failed" instead of the manual flow's
 * "Prepared".
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
      await prisma.whatsappLog.create({
        data: {
          repairJobId: job.id,
          messageType: params.messageType,
          recipientNumber: job.customer.phoneNumber || "—",
          generatedMessage: "(not sent automatically — no valid WhatsApp number on file)",
          messageStatus: "Failed",
        },
      });
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

    await prisma.whatsappLog.create({
      data: {
        repairJobId: job.id,
        messageType: params.messageType,
        recipientNumber: normalizedPhone,
        generatedMessage: result.ok ? message : `${message}\n\n(send failed: ${result.error})`,
        messageStatus: result.ok ? "Sent" : "Failed",
        sentAt: result.ok ? new Date() : null,
      },
    });
  } catch (err) {
    // Last-resort guard — this function must never throw into a caller
    // that's in the middle of returning an unrelated HTTP response.
    console.error("Auto WhatsApp send failed:", err);
  }
}
