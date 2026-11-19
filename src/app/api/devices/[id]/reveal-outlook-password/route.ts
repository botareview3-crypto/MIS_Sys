import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";
import { decryptCredential } from "@/lib/credentials";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<{ id: string }> };

/**
 * Ported from app/pages/devices/reveal-outlook-password.php. Decrypts and
 * returns a customer's Outlook password in plaintext, on demand, for the
 * "Show" button on the device detail page — never sent as part of the
 * normal device payload.
 *
 * Role check matches the original exactly: Admin, Reception, Technician —
 * Secondary Admin is NOT included here even though (same as the original)
 * the "Show" button itself is visible to Secondary Admin on the device
 * page, since the page's own role gate is Admin/Secondary
 * Admin/Reception/Technician. That's an inconsistency carried over from
 * the original app as-is, not something introduced or "fixed" by this
 * port — see docs/commit-log.md.
 *
 * No CSRF token, consistent with the CSRF-drop decision already made for
 * this codebase (docs/status.md deviation #3) — the original protected
 * this specific endpoint with one, but every other mutating endpoint here
 * already relies on the session cookie (SameSite=Lax) + POST-only instead.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  let session;
  try {
    session = await requireApiRoles(["Admin", "Reception", "Technician"]);
  } catch (e) {
    return apiAuthErrorResponse(e)!;
  }

  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId) || deviceId < 1) {
    return NextResponse.json({ error: "Invalid device record." }, { status: 400 });
  }

  const job = await prisma.repairJob.findUnique({
    where: { id: deviceId },
    select: { jobId: true, customer: { select: { outlookPasswordEncrypted: true } } },
  });

  if (!job) {
    return NextResponse.json({ error: "Device record not found." }, { status: 404 });
  }

  try {
    const password = decryptCredential(job.customer.outlookPasswordEncrypted);

    // Matches the original's own try/catch: an audit-log failure here
    // must not block returning the password.
    try {
      const ipAddress = req.headers.get("x-forwarded-for") ?? "unknown";
      await prisma.auditLog.create({
        data: {
          performedBy: session.userId,
          actionType: "credential_viewed",
          recordType: "repair_job",
          recordId: deviceId,
          recordReference: job.jobId,
          actionDetails: { credential: "outlook_password" },
          ipAddress,
        },
      });
    } catch (auditError) {
      console.error("Credential reveal audit failed:", auditError);
    }

    return NextResponse.json({ password });
  } catch (err) {
    console.error("Credential reveal failed:", err);
    return NextResponse.json({ error: "The Outlook password could not be decrypted." }, { status: 500 });
  }
}
