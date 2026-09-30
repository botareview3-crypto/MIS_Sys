import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrintReceiptButton } from "@/components/receipts/PrintReceiptButton";
import { HandoverForm } from "@/components/receipts/HandoverForm";
import { ReceiptDocument } from "@/components/receipts/ReceiptDocument";

/**
 * Ported from app/pages/receipts/receipt-preview.php. Deliberately outside
 * the `(app)` route group / sidebar layout — same as the original, this is
 * a standalone printable page, not a dashboard screen.
 *
 * Role check matches the original's requireRoles() exactly: Admin,
 * Reception, Technician. Secondary Admin is NOT included — this page is
 * simply inaccessible to that role (unlike the device detail page's
 * Outlook-password button, there's no partial-visibility inconsistency to
 * carry over here, since the original never rendered a receipt link for
 * Secondary Admin in the first place).
 *
 * A Technician is further scoped to receipts belonging to repair jobs
 * assigned to them (`assigned_technician_id`), exactly like the original's
 * conditional SQL clause.
 *
 * A "Delivery" receipt (auto-created when a job is marked Delivered) renders
 * as the customer-signed Equipment Handover Form (see HandoverForm) instead
 * of the intake-style receipt. Same page, same print tracking, same
 * role/scoping rules.
 */
export default async function ReceiptPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!["Admin", "Reception", "Technician"].includes(session.role)) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const receiptId = Number(id);
  if (!Number.isInteger(receiptId) || receiptId < 1) notFound();

  const isTechnician = session.role === "Technician";

  const receipt = await prisma.receipt.findFirst({
    where: {
      id: receiptId,
      ...(isTechnician ? { repairJob: { assignedTechnicianId: session.userId } } : {}),
    },
    include: {
      repairJob: {
        include: { customer: true, accessories: true },
      },
      creator: true,
    },
  });

  if (!receipt) notFound();

  const job = receipt.repairJob;
  const isDelivery = receipt.receiptType.toLowerCase() === "delivery";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between print:hidden">
          <Link href={`/devices/${job.id}`} className="btn-primary bg-slate-700 hover:bg-slate-800">
            ← Back to Device Details
          </Link>
          <PrintReceiptButton
            receiptId={receipt.id}
            initialPrintCount={receipt.printCount}
            baseLabel={isDelivery ? "Print Handover Form" : "Print Receipt"}
          />
        </div>

        {isDelivery ? (
          <HandoverForm
            job={job}
            receipt={{
              receiptReference: receipt.receiptReference,
              generatedAt: receipt.generatedAt,
              creatorName: receipt.creator?.fullName ?? null,
            }}
          />
        ) : (
        <ReceiptDocument
          job={job}
          receipt={{
            receiptType: receipt.receiptType,
            receiptReference: receipt.receiptReference,
            generatedAt: receipt.generatedAt,
            creatorName: receipt.creator?.fullName ?? null,
          }}
        />
        )}
      </div>
    </main>
  );
}
