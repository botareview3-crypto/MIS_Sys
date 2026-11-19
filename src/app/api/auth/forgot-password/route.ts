import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const ForgotSchema = z.object({ username: z.string().min(1) });

/**
 * Ported from app/pages/auth/forgot-password.php. This is an internal
 * system with no outgoing email — the original generates a one-time link
 * and shows it back to whoever submitted the form ("admin shares the
 * link"). We do the same: always respond 200 so the response status can't
 * be used to enumerate usernames, and only include a link when a matching,
 * active account was found.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ForgotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter your username." }, { status: 400 });
  }

  const username = parsed.data.username.trim();
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" }, deletedAt: null },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ found: false });
  }

  // Expire any existing outstanding tokens for this user first.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  const rawToken = crypto.randomBytes(32).toString("hex"); // 64 hex chars
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token: rawToken, expiresAt },
  });

  const resetLink = `${req.nextUrl.origin}/reset-password?token=${rawToken}`;

  return NextResponse.json({
    found: true,
    fullName: user.fullName,
    resetLink,
    generatedAt: new Date().toISOString(),
  });
}
