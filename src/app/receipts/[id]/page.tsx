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
 *
 * Receipt type "Delivery" (auto-created when a job is marked Delivered)
 * renders as the customer-signed Equipment Handover Form instead of the
 * intake-style receipt: it lists what the customer is actually taking
 * (the PC plus whichever accessories are flagged *returned*), not what was
 * received. Same page, same print tracking, same role/scoping rules.
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
  const isDelivery = receipt.receiptType.toLowerCase() === "delivery";
  const receiptTypeLabel = receipt.receiptType.replace(/[_-]/g, " ");

  // Handover form contents. The PC is always part of a delivery; each
  // accessory appears only if it is flagged returned. Anything received but
  // not (yet) returned is listed separately so the customer isn't signing
  // for it and staff can see it's still held.
  const acc = job.accessories;
  const handoverItems: { label: string; detail: string }[] = [
    {
      label: "PC / Laptop",
      detail: [
        `Barcode ${job.aucAssetBarcode}`,
        `S/N ${job.serialNumber}`,
        job.hostname ? `Hostname ${job.hostname}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
  ];
  if (acc?.chargerReturned) handoverItems.push({ label: "Charger", detail: "" });
  if (acc?.networkCableReturned) {
    handoverItems.push({
      label: "Network Cable (NIC)",
      detail: acc.networkCableBarcode ? `Barcode ${acc.networkCableBarcode}` : "",
    });
  }
  if (acc?.bagReturned) handoverItems.push({ label: "Computer Bag", detail: "" });

  const stillHeld: string[] = [];
  if (acc?.chargerReceived && !acc.chargerReturned) stillHeld.push("Charger");
  if (acc?.networkCableBarcode && !acc.networkCableReturned) stillHeld.push("Network Cable (NIC)");
  if (acc?.bagReceived && !acc.bagReturned) stillHeld.push("Computer Bag");

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white print:p-0">
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

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg print:rounded-none print:border-0 print:shadow-none">
          <header className="flex items-start justify-between gap-6 bg-gradient-to-br from-slate-900 via-slate-800 to-brand-700 px-8 py-7 text-white print:bg-slate-900 print:text-white print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 flex-shrink-0 place-items-center rounded-full border border-white/40 bg-white/10 text-lg font-black tracking-wide">
                AU
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/70">African Union Commission</p>
                <h1 className="text-2xl font-semibold leading-tight">MIS Repair Management System</h1>
                <p className="text-sm text-white/80">
                  {isDelivery ? "Equipment Handover Form" : `Device Repair ${receiptTypeLabel}`}
                </p>
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
            {isDelivery ? (
              <div>
                <span className="block text-xs text-slate-400">Delivered Date</span>
                <strong className="text-slate-900">{fmtDateTime(job.deliveredAt ?? receipt.generatedAt)}</strong>
              </div>
            ) : (
              <div>
                <span className="block text-xs text-slate-400">Current Status</span>
                <strong className="text-slate-900">{job.status}</strong>
              </div>
            )}
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
                <Row label="PC Barcode" value={job.aucAssetBarcode} />
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

          {isDelivery ? (
            <>
              <section className="border-t border-slate-100 px-8 py-6">
                <h2 className="text-sm font-semibold text-slate-900">Equipment Handed Over</h2>
                <table className="mt-3 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="w-10 py-2 font-medium">#</th>
                      <th className="py-2 font-medium">Item</th>
                      <th className="py-2 font-medium">Details</th>
                      <th className="w-24 py-2 text-center font-medium">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {handoverItems.map((item, i) => (
                      <tr key={item.label} className="border-b border-slate-100">
                        <td className="py-2.5 text-slate-400">{i + 1}</td>
                        <td className="py-2.5 font-semibold text-slate-900">{item.label}</td>
                        <td className="py-2.5 text-slate-600">{item.detail || "—"}</td>
                        <td className="py-2.5 text-center">
                          <span className="inline-grid h-5 w-5 place-items-center border border-slate-700 text-xs font-bold text-slate-900">
                            ✓
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stillHeld.length > 0 && (
                  <p className="mt-3 text-xs text-slate-500">
                    Not handed over at this time (still held by MIS): {stillHeld.join(", ")}.
                  </p>
                )}
              </section>

              <section className="border-t border-slate-100 px-8 py-6 text-sm text-slate-600">
                <p>
                  I, <strong className="text-slate-900">{customerDisplayName}</strong>, confirm that I have received
                  the equipment listed above from AUC MIS on the date below.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-8">
                  <div>
                    <span className="block text-xs text-slate-400">Released By</span>
                    <strong className="text-slate-900">{receipt.creator?.fullName || "Authorized staff"}</strong>
                    <div className="mt-8 border-t border-slate-300 pt-1 text-xs text-slate-400">
                      Staff Signature
                    </div>
                    <div className="mt-6 border-t border-slate-300 pt-1 text-xs text-slate-400">Date</div>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400">Received By (Customer)</span>
                    <strong className="text-slate-900">{customerDisplayName}</strong>
                    <div className="mt-8 border-t border-slate-300 pt-1 text-xs text-slate-400">
                      Customer Signature
                    </div>
                    <div className="mt-6 border-t border-slate-300 pt-1 text-xs text-slate-400">Date</div>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <>
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
                    <strong className="text-slate-900">
                      {job.accessories?.bagReceived ? "Received" : "Not received"}
                    </strong>
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
            </>
          )}

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
