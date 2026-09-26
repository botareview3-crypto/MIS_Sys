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

/**
 * Message templates, revised from the original three:
 * - Job ID dropped (staff-facing detail, not useful to the customer); the
 *   device's hostname is used instead so the customer can tell which
 *   machine is being referred to.
 * - "Thank you for trusting AUC MIS" dropped from the Received/Delivered
 *   templates — these are organization-owned PCs receiving mandatory
 *   maintenance, not a service the customer opted into, so gratitude-for-
 *   trust framing doesn't fit. Replaced with a plain statement of what
 *   happens next / an invitation to reach out.
 * - "Ready" supports a combined multi-device message via
 *   `otherReadyHostnames`: when a customer has more than one device in for
 *   repair, callers should only pass this once every device is Ready, so a
 *   single message goes out instead of one per device. See
 *   `getMultiDeviceReadyBlockMessage` for the corresponding "not all ready
 *   yet" guard.
 */
export function buildDefaultWhatsappMessage(
  messageType: WhatsappMessageType,
  opts: {
    customerName: string;
    hostname: string | null;
    receivedAt: Date;
    deliveredAt: Date | null;
    receivedAccessoryText: string;
    returnedAccessoryText: string;
    /** Hostnames of the customer's OTHER devices, only when all of them are also Ready. */
    otherReadyHostnames?: (string | null)[];
  },
): string {
  const deviceLabel = opts.hostname ? ` (${opts.hostname})` : "";

  if (messageType === "Received") {
    return (
      `Dear ${opts.customerName}, we received your computer${deviceLabel} for maintenance on ` +
      `${fmtDate(opts.receivedAt)} at ${fmtTime(opts.receivedAt)}. ` +
      `Items received: ${opts.receivedAccessoryText}. ` +
      `We will inform you once it is ready for pick-up.`
    );
  }

  if (messageType === "Ready") {
    if (opts.otherReadyHostnames && opts.otherReadyHostnames.length > 0) {
      const allDeviceLabels = [opts.hostname, ...opts.otherReadyHostnames]
        .map((h, i) => h || `device ${i + 1}`)
        .join(", ");
      return (
        `Dear ${opts.customerName}, maintenance for your computers (${allDeviceLabels}) is complete ` +
        `and they are all ready for collection. Please bring your receipt when collecting them.`
      );
    }
    return (
      `Dear ${opts.customerName}, maintenance for your computer${deviceLabel} is complete ` +
      `and it is ready for collection. Please bring your receipt when collecting it.`
    );
  }

  const deliveredAt = opts.deliveredAt ?? new Date();
  return (
    `Dear ${opts.customerName}, your computer${deviceLabel} was delivered on ` +
    `${fmtDate(deliveredAt)} at ${fmtTime(deliveredAt)} together with ` +
    `${opts.returnedAccessoryText}. The reported issue was addressed. ` +
    `Please contact AUC MIS if you notice any further issues.`
  );
}

/**
 * For the "Ready" message on a customer with multiple devices: the message
 * should only go out once every one of the customer's still-active devices
 * (not yet Delivered) is Ready. Pass the OTHER active devices' statuses
 * (excluding the current one) and this returns a non-empty error naming the
 * ones still in progress, or "" when it's safe to send.
 */
export function getMultiDeviceReadyBlockMessage(
  otherActiveDevices: { hostname: string | null; jobId: string; status: string }[],
): string {
  const notReady = otherActiveDevices.filter((d) => !["Ready", "Delivered"].includes(d.status));
  if (notReady.length === 0) return "";
  const names = notReady.map((d) => d.hostname || d.jobId).join(", ");
  return (
    `This customer has ${notReady.length} other device(s) still in progress (${names}). ` +
    `Wait until all of this customer's devices are ready before sending the Ready message.`
  );
}

/** Same credential-leak guard as the original's regex. */
export const WHATSAPP_FORBIDDEN_CONTENT =
  /password|passcode|credential|verification\s*code|one[- ]time\s*code|\botp\b/i;

export function buildWhatsappUrl(normalizedPhone: string, message: string): string {
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
