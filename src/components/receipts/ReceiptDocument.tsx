/**
 * Standard (non-Delivery) receipt: the Received and Ready receipts. Shared by
 * /receipts/[id] and /repairs/[id]/follow-up (Ready) so both print the exact
 * same document. Delivery receipts use HandoverForm instead.
 *
 * Plain server-renderable component (no hooks) — no "use client".
 */

export type ReceiptDocJob = {
  status: string;
  aucAssetBarcode: string;
  serialNumber: string;
  macAddress: string | null;
  hostname: string | null;
  reportedProblem: string;
  givenByName: string;
  receivedAt: Date;
  customer: { title: string | null; fullName: string; phoneNumber: string; outlookEmail: string };
  accessories: {
    chargerReceived: boolean;
    networkCableBarcode: string | null;
    bagReceived: boolean;
  } | null;
};

export type ReceiptDocReceipt = {
  receiptType: string;
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

export function ReceiptDocument({ job, receipt }: { job: ReceiptDocJob; receipt: ReceiptDocReceipt }) {
  const customer = job.customer;
  const customerDisplayName = `${customer.title ?? ""} ${customer.fullName}`.trim();
  const receiptTypeLabel = receipt.receiptType.replace(/[_-]/g, " ");

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
        <span className="block text-xs text-slate-400">Hostname</span>
        <strong className="text-slate-900">{job.hostname || "—"}</strong>
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
          <strong className="text-slate-900">{receipt.creatorName || "Authorized staff"}</strong>
          <div className="mt-8 border-t border-slate-300 pt-1 text-xs text-slate-400">Staff Signature</div>
        </div>
        <div>
          <span className="block text-xs text-slate-400">Customer</span>
          <strong className="text-slate-900">{customerDisplayName}</strong>
          <div className="mt-8 border-t border-slate-300 pt-1 text-xs text-slate-400">Customer Signature</div>
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
