import { prisma } from "@/lib/prisma";

export type TokenCheck =
  | { valid: true; tokenId: number; userId: number; username: string; fullName: string }
  | { valid: false; message: string };

/**
 * Mirrors the validation in app/pages/auth/reset-password.php:
 * well-formed (64 hex chars) -> exists -> not used -> not expired.
 * Read-only: does not mark anything as used. Callers that go on to
 * actually reset the password do that in their own step.
 */
export async function checkResetToken(rawToken: string): Promise<TokenCheck> {
  if (rawToken.length !== 64 || !/^[0-9a-f]+$/i.test(rawToken)) {
    return { valid: false, message: "This reset link is invalid or has expired." };
  }

  const row = await prisma.passwordResetToken.findUnique({
    where: { token: rawToken },
    include: { user: true },
  });

  if (!row) {
    return { valid: false, message: "This reset link is invalid or has already been used." };
  }
  if (row.used) {
    return { valid: false, message: "This reset link has already been used. Please request a new one." };
  }
  if (new Date() > row.expiresAt) {
    return { valid: false, message: "This reset link has expired. Please request a new one." };
  }

  return {
    valid: true,
    tokenId: row.id,
    userId: row.userId,
    username: row.user.username,
    fullName: row.user.fullName,
  };
}
