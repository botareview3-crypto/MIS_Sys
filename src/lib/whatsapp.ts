/**
 * Ported from app/pages/receipts/whatsapp-message.php. Kept as shared
 * helpers because both the page (initial message + phone preview) and the
 * API route (server-side re-validation on submit) need the exact same
 * phone-normalization and message-generation logic — the original computed
 * both in the same request, we split them across a server component and an
 * API route.
 */

export const WHATSAPP_MESSAGE_TYPES = ["Received", "Ready", "Delivered"] as const;
export type WhatsappMessageType = (typeof WHATSAPP_MESSAGE_TYPES)[number];

export function isWhatsappMessageType(value: string): value is WhatsappMessageType {
  return (WHATSAPP_MESSAGE_TYPES as readonly string[]).includes(value);
}

/**
 * Ethiopia-oriented normalization, exactly as the original:
 * - strip everything but digits
 * - a leading "00" (international dialing prefix) is dropped
 * - a leading "0" (local trunk prefix) becomes "251"
 * - a bare 9-digit number starting with 7 or 9 (mobile) gets "251" prepended
 * - result must match /^[1-9][0-9]{7,14}$/ or it's rejected
 * Returns "" (matching the original's empty-string state) when invalid.
 */
export function normalizePhoneForWhatsapp(rawPhone: string): string {
  let digits = (rawPhone || "").replace(/[^0-9]/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("0")) {
    digits = "251" + digits.slice(1);
  } else if (digits.length === 9 && (digits[0] === "7" || digits[0] === "9")) {
    digits = "251" + digits;
  }

  return /^[1-9][0-9]{7,14}$/.test(digits) ? digits : "";
}

/** Mirrors the workflow-availability checks at the top of the original. */
export function getWhatsappWorkflowError(messageType: WhatsappMessageType, jobStatus: string): string {
  if (messageType === "Ready" && !["Ready", "Delivered"].includes(jobStatus)) {
    return "The Ready message is available only after the device is marked Ready.";
  }
  if (messageType === "Delivered" && jobStatus !== "Delivered") {
    return "The Delivered message is available only after delivery is completed.";
  }
  return "";
}

function accessoryText(items: string[], emptyLabel: string): string {
  return items.length > 0 ? items.join(", ") : emptyLabel;
}

export function buildReceivedAccessoryText(opts: {
  chargerReceived: boolean;
  networkCableBarcode: string | null;
  bagReceived: boolean;
}): string {
  const items: string[] = [];
  if (opts.chargerReceived) items.push("charger");
  if ((opts.networkCableBarcode ?? "").trim() !== "") items.push("network cable");
  if (opts.bagReceived) items.push("computer bag");
  return accessoryText(items, "device only");
}

export function buildReturnedAccessoryText(opts: {
  chargerReturned: boolean;
  networkCableReturned: boolean;
  bagReturned: boolean;
}): string {
  const items: string[] = [];
  if (opts.chargerReturned) items.push("charger");
  if (opts.networkCableReturned) items.push("network cable");
  if (opts.bagReturned) items.push("computer bag");
  return accessoryText(items, "the device only");
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function fmtTime(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).format(d);
}

/** Mirrors the three message templates in the original exactly. */
export function buildDefaultWhatsappMessage(
  messageType: WhatsappMessageType,
  opts: {
    customerName: string;
    jobId: string;
    receivedAt: Date;
    deliveredAt: Date | null;
    receivedAccessoryText: string;
    returnedAccessoryText: string;
  },
): string {
  if (messageType === "Received") {
    return (
      `Dear ${opts.customerName}, we received your computer for maintenance on ` +
      `${fmtDate(opts.receivedAt)} at ${fmtTime(opts.receivedAt)}. ` +
      `Items received: ${opts.receivedAccessoryText}. Your Job ID is ${opts.jobId}. ` +
      `Thank you for trusting AUC MIS.`
    );
  }
  if (messageType === "Ready") {
    return (
      `Dear ${opts.customerName}, maintenance for your computer is complete ` +
      `and it is ready for collection. Your Job ID is ${opts.jobId}. ` +
      `Please bring your receipt when collecting it.`
    );
  }
  const deliveredAt = opts.deliveredAt ?? new Date();
  return (
    `Dear ${opts.customerName}, your computer was delivered on ` +
    `${fmtDate(deliveredAt)} at ${fmtTime(deliveredAt)} together with ` +
    `${opts.returnedAccessoryText}. The reported issue was addressed. ` +
    `Thank you for trusting AUC MIS.`
  );
}

/** Same credential-leak guard as the original's regex. */
export const WHATSAPP_FORBIDDEN_CONTENT =
  /password|passcode|credential|verification\s*code|one[- ]time\s*code|\botp\b/i;

export function buildWhatsappUrl(normalizedPhone: string, message: string): string {
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
