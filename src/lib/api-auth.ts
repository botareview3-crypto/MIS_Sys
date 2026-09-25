import { NextResponse } from "next/server";
import { getSession, SessionPayload } from "@/lib/auth";

export class ApiAuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

/** Mirrors requireRoles() in includes/auth.php. Throws, caller should catch and respond. */
export async function requireApiRoles(allowedRoles: SessionPayload["role"][]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new ApiAuthError(401, "Not authenticated.");
  if (!allowedRoles.includes(session.role)) {
    throw new ApiAuthError(403, "Access denied. You do not have permission to do this.");
  }
  return session;
}

export function apiAuthErrorResponse(error: unknown) {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}
