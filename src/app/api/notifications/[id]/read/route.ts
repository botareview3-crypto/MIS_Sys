import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<{ id: string }> };

/**
 * Ported from app/pages/notifications/mark-notification-read.php.
 * No CSRF token needed here (unlike the PHP version) — Next's session
 * cookie is SameSite=Lax and this app has no cross-origin POST surface.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  let session;
  try {
    session = await requireApiRoles(["Admin", "Secondary Admin", "Reception", "Technician"]);
  } catch (e) {
    const authError = apiAuthErrorResponse(e);
    if (authError) return authError;
    throw e;
  }

  const { id } = await params;
  const notificationId = Number(id);
  if (!Number.isInteger(notificationId) || notificationId < 1) {
    return NextResponse.json({ error: "The selected notification is invalid." }, { status: 400 });
  }

  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, recipientUserId: session.userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "That notification is no longer available." }, { status: 404 });
  }

  // Mirrors read_at = COALESCE(read_at, CURRENT_TIMESTAMP) — don't clobber an existing read_at.
  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: existing.readAt ?? new Date() },
  });

  return NextResponse.json({ ok: true });
}
