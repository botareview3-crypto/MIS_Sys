/**
 * Standard (non-Delivery) receipt: the Received and Ready receipts. Shared by
 * /receipts/[id] and /repairs/[id]/follow-up (Ready) so both print the exact
 * same document. Delivery receipts use HandoverForm instead.
 *
 * Laid out as an A6 sheet (105 x 148 mm, a quarter of A4) - see
 * sheet-parts.tsx and the @page rule in globals.css.
 *
 * Plain server-renderable component (no hooks) — no "use client".
 */

import { Field, FieldList, MetaStrip, SectionTitle, SheetHeader, SignatureLine, fmtDateTime } from "./sheet-parts";

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

export function ReceiptDocument({ job, receipt }: { job: ReceiptDocJob; receipt: ReceiptDocReceipt }) {
  const customer = job.customer;
  const customerDisplayName = `${customer.title ?? ""} ${customer.fullName}`.trim();
  const receiptTypeLabel = receipt.receiptType.replace(/[_-]/g, " ");

  return (
    <article className="a6-sheet overflow-hidden rounded-lg border border-slate-200 bg-white text-[7pt] leading-tight text-slate-700 shadow-lg print:rounded-none print:border-0 print:shadow-none">
      <SheetHeader
        subtitle={`Device Repair ${receiptTypeLabel}`}
        reference={receipt.receiptReference}
        generatedAt={receipt.generatedAt}
      />

      <MetaStrip
        items={[
          { label: "Hostname", value: job.hostname || "—" },
          { label: "Current Status", value: job.status },
          { label: "Received Date", value: fmtDateTime(job.receivedAt) },
        ]}
      />

      <section className="grid grid-cols-2 gap-[3mm] px-[4mm] py-[2.5mm]">
        <div className="min-w-0">
          <SectionTitle>Customer Information</SectionTitle>
          <FieldList>
            <Field label="Full Name" value={customerDisplayName} />
            <Field label="Phone Number" value={customer.phoneNumber} />
            <Field label="Outlook Email" value={customer.outlookEmail} />
            <Field label="Device Given By" value={job.givenByName} />
          </FieldList>
        </div>
        <div className="min-w-0">
          <SectionTitle>Device Information</SectionTitle>
          <FieldList>
            <Field label="PC Barcode" value={job.aucAssetBarcode} />
            <Field label="Serial Number" value={job.serialNumber} />
            <Field label="MAC Address" value={job.macAddress || "Not provided"} />
            <Field label="Reported Problem" value={job.reportedProblem} />
          </FieldList>
        </div>
      </section>

      <section className="border-t border-slate-100 px-[4mm] py-[2.5mm]">
        <SectionTitle>Accessories Received</SectionTitle>
        <div className="grid grid-cols-3 gap-[2mm]">
          <div className="min-w-0">
            <span className="block text-[6pt] text-slate-400">Charger</span>
            <strong className="block text-[7pt] leading-tight text-slate-900">
              {job.accessories?.chargerReceived ? "Received" : "Not received"}
            </strong>
          </div>
          <div className="min-w-0">
            <span className="block text-[6pt] text-slate-400">Network Cable</span>
            <strong className="block break-words text-[7pt] leading-tight text-slate-900">
              {job.accessories?.networkCableBarcode || "Not received"}
            </strong>
          </div>
          <div className="min-w-0">
            <span className="block text-[6pt] text-slate-400">Computer Bag</span>
            <strong className="block text-[7pt] leading-tight text-slate-900">
              {job.accessories?.bagReceived ? "Received" : "Not received"}
            </strong>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-100 px-[4mm] py-[2.5mm] text-[6.5pt] leading-snug text-slate-600">
        <p>
          This receipt confirms that the device and listed accessories were recorded in the AUC MIS Repair
          Management System.
        </p>
        <div className="mt-[2mm] grid grid-cols-2 gap-[5mm]">
          <div className="min-w-0">
            <span className="block text-[6pt] text-slate-400">Created By</span>
            <strong className="block break-words text-[7pt] leading-tight text-slate-900">
              {receipt.creatorName || "Authorized staff"}
            </strong>
            <SignatureLine>Staff Signature</SignatureLine>
          </div>
          <div className="min-w-0">
            <span className="block text-[6pt] text-slate-400">Customer</span>
            <strong className="block break-words text-[7pt] leading-tight text-slate-900">
              {customerDisplayName}
            </strong>
            <SignatureLine>Customer Signature</SignatureLine>
          </div>
        </div>
      </section>
    </article>
  );
}
