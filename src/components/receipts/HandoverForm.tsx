/**
 * Customer-signed Equipment Handover Form, rendered from a Delivery receipt.
 * Shared by /receipts/[id] (standalone print page) and
 * /repairs/[id]/handover (WhatsApp message + printable form on one page),
 * so both always print the exact same document.
 *
 * Contents: the PC always, plus ONLY the accessories flagged *returned*
 * (charger, network cable / NIC, bag). Anything received but not returned is
 * listed as "still held by MIS" so the customer never signs for it.
 *
 * Plain server-renderable component (no hooks) — no "use client".
 */

export type HandoverFormJob = {
  jobId: string;
  status: string;
  aucAssetBarcode: string;
  serialNumber: string;
  macAddress: string | null;
  hostname: string | null;
  reportedProblem: string;
  givenByName: string;
  receivedAt: Date;
  deliveredAt: Date | null;
  customer: { title: string | null; fullName: string; phoneNumber: string; outlookEmail: string };
  accessories: {
    chargerReceived: boolean;
    chargerReturned: boolean;
    networkCableBarcode: string | null;
    networkCableReturned: boolean;
    bagReceived: boolean;
    bagReturned: boolean;
  } | null;
};

export type HandoverFormReceipt = {
  receiptReference: string;
  generatedAt: Date;
  creatorName: string | null;
};

function fmtDateTime(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function HandoverForm({ job, receipt }: { job: HandoverFormJob; receipt: HandoverFormReceipt }) {
  const customer = job.customer;
  const customerDisplayName = `${customer.title ?? ""} ${customer.fullName}`.trim();
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
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg print:rounded-none print:border-0 print:shadow-none">
      <header className="flex items-start justify-between gap-6 bg-gradient-to-br from-slate-900 via-slate-800 to-brand-700 px-8 py-7 text-white print:bg-slate-900 print:text-white print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 flex-shrink-0 place-items-center rounded-full border border-white/40 bg-white/10 text-lg font-black tracking-wide">
            AU
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">African Union Commission</p>
            <h1 className="text-2xl font-semibold leading-tight">MIS Repair Management System</h1>
            <p className="text-sm text-white/80">Equipment Handover Form</p>
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
          <span className="block text-xs text-slate-400">Hostname</span>
          <strong className="text-slate-900">{job.hostname || "—"}</strong>
        </div>
        <div>
          <span className="block text-xs text-slate-400">Delivered Date</span>
          <strong className="text-slate-900">{fmtDateTime(job.deliveredAt ?? receipt.generatedAt)}</strong>
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
          I, <strong className="text-slate-900">{customerDisplayName}</strong>, confirm that I have received the
          equipment listed above from AUC MIS on the date below.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-8">
          <div>
            <span className="block text-xs text-slate-400">Released By</span>
            <strong className="text-slate-900">{receipt.creatorName || "Authorized staff"}</strong>
            <div className="mt-8 border-t border-slate-300 pt-1 text-xs text-slate-400">Staff Signature</div>
            <div className="mt-6 border-t border-slate-300 pt-1 text-xs text-slate-400">Date</div>
          </div>
          <div>
            <span className="block text-xs text-slate-400">Received By (Customer)</span>
            <strong className="text-slate-900">{customerDisplayName}</strong>
            <div className="mt-8 border-t border-slate-300 pt-1 text-xs text-slate-400">Customer Signature</div>
            <div className="mt-6 border-t border-slate-300 pt-1 text-xs text-slate-400">Date</div>
          </div>
        </div>
      </section>
    </article>
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
