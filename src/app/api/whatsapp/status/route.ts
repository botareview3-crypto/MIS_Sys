import { NextResponse } from "next/server";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";
import { getWhatsappStatus } from "@/lib/whatsapp-client";

/**
 * Polled by the WhatsApp Setup admin page (every few seconds) to show the
 * current pairing QR code and connection status. Admin only — the QR code
 * lets whoever scans it take over sending as the paired number.
 */
export async function GET() {
  let session;
  try {
    session = await requireApiRoles(["Admin"]);
  } catch (e) {
    const authError = apiAuthErrorResponse(e);
    if (authError) return authError;
    throw e;
  }
  void session;

  const state = getWhatsappStatus();
  return NextResponse.json({
    status: state.status,
    qrDataUrl: state.qrDataUrl,
    lastError: state.lastError,
  });
}
