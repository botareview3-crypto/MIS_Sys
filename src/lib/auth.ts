import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "arp_session";

// Normal sign-in lasts 12 hours. Ticking "Remember me" on the login page keeps
// the user signed in for 30 days (added 2026-09-30).
const DEFAULT_SESSION_SECONDS = 60 * 60 * 12;
const REMEMBER_SESSION_SECONDS = 60 * 60 * 24 * 30;
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET);

export type SessionPayload = {
  userId: number;
  username: string;
  fullName: string;
  role: "Admin" | "Secondary Admin" | "Reception" | "Technician";
  /** True when the user ticked "Remember me" (30-day session). */
  remember?: boolean;
};

/**
 * Existing rows were hashed with PHP's password_hash() (bcrypt, "$2y$" prefix).
 * bcryptjs only recognizes "$2a$"/"$2b$" - the algorithm is identical, only the
 * prefix differs, so we normalize it before comparing. This keeps every
 * existing user's password working without a re-hash migration.
 */
export async function verifyPassword(plain: string, phpHash: string): Promise<boolean> {
  const normalized = phpHash.startsWith("$2y$") ? "$2b$" + phpHash.slice(4) : phpHash;
  return bcrypt.compare(plain, normalized);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function createSession(payload: SessionPayload, remember = false) {
  const seconds = remember ? REMEMBER_SESSION_SECONDS : DEFAULT_SESSION_SECONDS;
  const token = await new SignJWT({ ...payload, remember })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${seconds}s`)
    .sign(secret());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: seconds,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const session = payload as unknown as SessionPayload;

    // A 30-day "Remember me" session must not outlive the account: if the
    // user was deactivated or deleted since signing in, end the session now
    // instead of waiting for the token to expire.
    if (session.remember) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { isActive: true, deletedAt: true },
      });
      if (!user || !user.isActive || user.deletedAt) return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Mirrors the progressive lockout in includes auth: escalating lock duration per failed attempt tier. */
export function lockDurationSeconds(lockLevel: number): number {
  const tiers = [0, 30, 60, 300, 900, 3600];
  return tiers[Math.min(lockLevel, tiers.length - 1)];
}
