import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";
import { hashPassword } from "@/lib/auth";
import { isValidNewPassword } from "@/lib/user-validation";

const ResetSchema = z.object({ newPassword: z.string(), passwordConfirmation: z.string() });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  let session;
  try {
    session = await requireApiRoles(["Admin"]);
  } catch (e) {
    return apiAuthErrorResponse(e)!;
  }

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId < 1) {
    return NextResponse.json({ error: "The user account no longer exists." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please provide a new password." }, { status: 400 });
  }
  const { newPassword, passwordConfirmation } = parsed.data;

  if (!isValidNewPassword(newPassword)) {
    return NextResponse.json({ error: "Password must contain between 8 and 255 characters." }, { status: 400 });
  }
  if (newPassword !== passwordConfirmation) {
    return NextResponse.json({ error: "The password confirmation does not match." }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("The user account no longer exists.");

      const passwordHash = await hashPassword(newPassword);
      await tx.user.update({ where: { id: userId }, data: { password: passwordHash } });

      await tx.auditLog.create({
        data: {
          performedBy: session.userId,
          actionType: "password_reset",
          recordType: "user",
          recordId: userId,
          recordReference: user.username,
          actionDetails: {
            user_id: user.id,
            username: user.username,
            role: user.role,
            changed_by_self: userId === session.userId,
          },
          reason: "Password reset by an administrator.",
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The password could not be updated.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
