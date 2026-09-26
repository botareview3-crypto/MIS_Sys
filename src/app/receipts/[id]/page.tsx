import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrintReceiptButton } from "@/components/receipts/PrintReceiptButton";

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
 */
function fmtDateTime(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

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
  const customer = job.customer;
  const customerDisplayName = `${customer.title ?? ""} ${customer.fullName}`.trim();
  const receiptTypeLabel = receipt.receiptType.replace(/[_-]/g, " ");

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between print:hidden">
          <Link href={`/devices/${job.id}`} className="btn-primary bg-slate-700 hover:bg-slate-800">
            ← Back to Device Details
          </Link>
          <PrintReceiptButton receiptId={receipt.id} initialPrintCount={receipt.printCount} />
        </div>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg print:rounded-none print:border-0 print:shadow-none">
          <header className="flex items-start justify-between gap-6 bg-gradient-to-br from-slate-900 via-slate-800 to-brand-700 px-8 py-7 text-white print:bg-slate-900 print:text-white">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 flex-shrink-0 place-items-center rounded-full border border-white/40 bg-white/10 text-lg font-black tracking-wide">
                AU
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/70">African Union Commission</p>
                <h1 className="text-2xl font-semibold leading-tight">MIS Repair Management System</h1>
                <p className="text-sm text-white/80">Device Repair {receiptTypeLabel}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="block text-xs uppercase tracking-wide text-white/70">Receipt Reference</span>
              <strong className="block text-lg">{receipt.receiptReference}</strong>
              <small className="text-white/70">Generated: {fmtDateTime(receipt.generatedAt)}</small>
            </div>
          </header>

          <section className="grid grid-cols-3 gap-4 border-b border-slate-100 bg-slate-50 px-8 py-4 text-sm">
            <div>
              <span className="block text-xs text-slate-400">Permanent Job ID</span>
              <strong className="text-slate-900">{job.jobId}</strong>
            </div>
            <div>
              <span className="block text-xs text-slate-400">Current Status</span>
              <strong className="text-slate-900">{job.status}</strong>
            </div>
            <div>
              <span className="block text-xs text-slate-400">Received Date</span>
              <strong className="text-slate-900">{fmtDateTime(job.receivedAt)}</strong>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-6 px-8 py-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Customer Information</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Full Name" value={customerDisplayName} />
                <Row label="Phone Number" value={customer.phoneNumber} />
                <Row label="Outlook Email" value={customer.outlookEmail} />
                <Row label="Device Given By" value={job.givenByName} />
              </dl>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Device Information</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="AUC Asset Barcode" value={job.aucAssetBarcode} />
                <Row label="Serial Number" value={job.serialNumber} />
                <Row label="MAC Address" value={job.macAddress || "Not provided"} />
                <Row label="Hostname" value={job.hostname || "Not provided"} />
                <div>
                  <dt className="text-xs text-slate-400">Reported Problem</dt>
                  <dd className="mt-0.5 whitespace-pre-line text-slate-700">{job.reportedProblem}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="border-t border-slate-100 px-8 py-6">
            <h2 className="text-sm font-semibold text-slate-900">Accessories Received</h2>
            <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="block text-xs text-slate-400">Charger</span>
                <strong className="text-slate-900">
                  {job.accessories?.chargerReceived ? "Received" : "Not received"}
                </strong>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Network Cable</span>
                <strong className="text-slate-900">
                  {job.accessories?.networkCableBarcode || "Not received"}
                </strong>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Computer Bag</span>
                <strong className="text-slate-900">{job.accessories?.bagReceived ? "Received" : "Not received"}</strong>
              </div>
            </div>
          </section>

          <section className="border-t border-slate-100 px-8 py-6 text-sm text-slate-600">
            <p>
              This receipt confirms that the device and listed accessories were recorded in the AUC MIS Repair
              Management System.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-8">
              <div>
                <span className="block text-xs text-slate-400">Created By</span>
                <strong className="text-slate-900">{receipt.creator?.fullName || "Authorized staff"}</strong>
                <div className="mt-8 border-t border-slate-300 pt-1 text-xs text-slate-400">Staff Signature</div>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Customer</span>
                <strong className="text-slate-900">{customerDisplayName}</strong>
                <div className="mt-8 border-t border-slate-300 pt-1 text-xs text-slate-400">Customer Signature</div>
              </div>
            </div>
          </section>

          <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-8 py-3 text-xs text-slate-400">
            <span>{receipt.receiptReference}</span>
            <span>© 2026 AUC MIS Repair Management System</span>
            <span>Developed by Hindiya Jemal</span>
          </footer>
        </article>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value}</dd>
    </div>
  );
}
