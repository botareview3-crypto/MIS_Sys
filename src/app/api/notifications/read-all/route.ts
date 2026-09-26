import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";

/** Ported from app/pages/notifications/mark-all-notifications-read.php. */
export async function POST() {
  let session;
  try {
    session = await requireApiRoles(["Admin", "Secondary Admin", "Reception", "Technician"]);
  } catch (e) {
    const authError = apiAuthErrorResponse(e);
    if (authError) return authError;
    throw e;
  }

  const result = await prisma.notification.updateMany({
    where: { recipientUserId: session.userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
