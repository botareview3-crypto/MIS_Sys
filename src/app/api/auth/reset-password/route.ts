import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { isValidNewPassword } from "@/lib/user-validation";
import { checkResetToken } from "@/lib/password-reset";

// GET /api/auth/reset-password?token=... — read-only validity check, used
// by the reset-password page on load so it can show the right form/state
// before the user types anything.
export async function GET(req: NextRequest) {
  const rawToken = (req.nextUrl.searchParams.get("token") ?? "").trim();
  const check = await checkResetToken(rawToken);

  if (!check.valid) {
    return NextResponse.json({ valid: false, message: check.message });
  }
  return NextResponse.json({ valid: true, fullName: check.fullName });
}

const ResetSchema = z.object({
  token: z.string().min(1),
  password: z.string(),
  passwordConfirmation: z.string(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  const rawToken = parsed.data.token.trim();
  const { password, passwordConfirmation } = parsed.data;

  const check = await checkResetToken(rawToken);
  if (!check.valid) {
    return NextResponse.json({ error: check.message }, { status: 400 });
  }

  if (!isValidNewPassword(password)) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (password !== passwordConfirmation) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  const clientAddress = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      const passwordHash = await hashPassword(password);

      await tx.user.update({
        where: { id: check.userId },
        data: { password: passwordHash, updatedAt: new Date() },
      });

      await tx.passwordResetToken.update({
        where: { id: check.tokenId },
        data: { used: true },
      });

      await tx.auditLog.create({
        data: {
          performedBy: null,
          actionType: "password_reset",
          recordType: "user",
          recordId: check.userId,
          recordReference: check.username,
          reason: "Self-service password reset via token",
          ipAddress: clientAddress,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not update your password. Please try again." }, { status: 400 });
  }
}
