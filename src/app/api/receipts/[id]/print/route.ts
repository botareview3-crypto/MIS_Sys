import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<{ id: string }> };

/**
 * Ported from app/pages/receipts/mark-receipt-printed.php. Increments
 * `print_count` / sets `printed_at` on a receipt and writes an audit log
 * entry, in one transaction. Called right before the client opens the
 * browser print dialog (see PrintReceiptButton).
 *
 * Role check matches the original: Admin, Reception, Technician (Secondary
 * Admin excluded entirely — same as receipt-preview.php). A Technician is
 * further scoped to receipts on repair jobs assigned to them, matching the
 * original's conditional `EXISTS (...)` clause.
 *
 * No CSRF token — same established decision as the rest of this codebase
 * (docs/status.md deviation #3); the session cookie (SameSite=Lax) +
 * POST-only takes its place.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  let session;
  try {
    session = await requireApiRoles(["Admin", "Reception", "Technician"]);
  } catch (e) {
    const authError = apiAuthErrorResponse(e);
    if (authError) return authError;
    throw e;
  }

  const { id } = await params;
  const receiptId = Number(id);
  if (!Number.isInteger(receiptId) || receiptId < 1) {
    return NextResponse.json({ success: false, message: "Invalid receipt record." }, { status: 422 });
  }

  const isTechnician = session.role === "Technician";

  try {
    const updatedReceipt = await prisma.$transaction(async (tx: any) => {
      const receipt = await tx.receipt.findFirst({
        where: {
          id: receiptId,
          ...(isTechnician ? { repairJob: { assignedTechnicianId: session.userId } } : {}),
        },
      });

      if (!receipt) return null;

      return tx.receipt.update({
        where: { id: receiptId },
        data: {
          printedAt: new Date(),
          printCount: { increment: 1 },
        },
      });
    });

    if (!updatedReceipt) {
      return NextResponse.json(
        { success: false, message: "Receipt not found, or access was denied." },
        { status: 404 },
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for") ?? "unknown";

    // Matches the original's own error handling: an audit-log failure here
    // must not block confirming the print was recorded.
    try {
      await prisma.auditLog.create({
        data: {
          performedBy: session.userId,
          actionType: "receipt_printed",
          recordType: "receipt",
          recordId: updatedReceipt.id,
          recordReference: updatedReceipt.receiptReference,
          actionDetails: {
            receiptType: updatedReceipt.receiptType,
            repairJobId: updatedReceipt.repairJobId,
            printCount: updatedReceipt.printCount,
            printedAt: updatedReceipt.printedAt,
          },
          reason: "Receipt printed from the receipt preview page.",
          ipAddress,
        },
      });
    } catch (auditError) {
      console.error("Receipt print audit log failed:", auditError);
    }

    return NextResponse.json({
      success: true,
      message: "Receipt print recorded.",
      printedAt: updatedReceipt.printedAt,
      printCount: updatedReceipt.printCount,
    });
  } catch (err) {
    console.error("Receipt print tracking failed:", err);
    return NextResponse.json(
      { success: false, message: "The receipt print could not be recorded." },
      { status: 500 },
    );
  }
}
