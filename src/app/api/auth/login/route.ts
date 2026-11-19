import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword, lockDurationSeconds } from "@/lib/auth";

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter both your username and password." }, { status: 400 });
  }
  const { username, password } = parsed.data;

  const clientAddress = req.headers.get("x-forwarded-for") ?? "unknown";
  const attemptKey = crypto
    .createHash("sha256")
    .update(`${username.trim().toLowerCase()}|${clientAddress}`)
    .digest("hex");

  const attempt = await prisma.loginAttempt.findUnique({ where: { attemptKey } });
  if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) {
    const secondsRemaining = Math.ceil((attempt.lockedUntil.getTime() - Date.now()) / 1000);
    return NextResponse.json(
      { error: `Too many incorrect passwords. Try again in ${secondsRemaining} seconds.` },
      { status: 429 },
    );
  }

  const user = await prisma.user.findFirst({
    where: { username: { equals: username.trim(), mode: "insensitive" }, deletedAt: null },
  });

  const passwordOk = user ? await verifyPassword(password, user.password) : false;

  if (!user || !passwordOk) {
    const failedAttempts = (attempt?.failedAttempts ?? 0) + 1;
    const lockLevel = failedAttempts >= 3 ? (attempt?.lockLevel ?? 0) + 1 : attempt?.lockLevel ?? 0;
    const lockSeconds = failedAttempts >= 3 ? lockDurationSeconds(lockLevel) : 0;

    await prisma.loginAttempt.upsert({
      where: { attemptKey },
      create: {
        attemptKey,
        failedAttempts,
        lockLevel,
        lockedUntil: lockSeconds ? new Date(Date.now() + lockSeconds * 1000) : null,
      },
      update: {
        failedAttempts,
        lockLevel,
        lockedUntil: lockSeconds ? new Date(Date.now() + lockSeconds * 1000) : null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  if (!user.isActive) {
    return NextResponse.json({ error: "This account has been deactivated." }, { status: 403 });
  }

  // Successful login clears the attempt counter.
  await prisma.loginAttempt.deleteMany({ where: { attemptKey } });

  await createSession({
    userId: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role as "Admin" | "Secondary Admin" | "Reception" | "Technician",
  });

  return NextResponse.json({ ok: true });
}
