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
 * Laid out as an A6 sheet (105 x 148 mm, a quarter of A4) - see
 * sheet-parts.tsx and the @page rule in globals.css.
 *
 * Plain server-renderable component (no hooks) — no "use client".
 */

import { Field, MetaStrip, SectionTitle, SheetHeader, SignatureLine, fmtDateTime } from "./sheet-parts";

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
    <article className="a6-sheet overflow-hidden rounded-lg border border-slate-200 bg-white text-[7.5pt] text-slate-700 shadow-lg print:rounded-none print:border-0 print:shadow-none">
      <SheetHeader
        subtitle="Equipment Handover Form"
        reference={receipt.receiptReference}
        generatedAt={receipt.generatedAt}
      />

      <MetaStrip
        items={[
          { label: "Hostname", value: job.hostname || "—" },
          { label: "Delivered Date", value: fmtDateTime(job.deliveredAt ?? receipt.generatedAt) },
          { label: "Received Date", value: fmtDateTime(job.receivedAt) },
        ]}
      />

      <section className="grid grid-cols-2 gap-[3mm] px-[4mm] py-[2.5mm]">
        <div className="min-w-0">
          <SectionTitle>Customer Information</SectionTitle>
          <dl>
            <Field label="Full Name" value={customerDisplayName} />
            <Field label="Phone Number" value={customer.phoneNumber} />
            <Field label="Outlook Email" value={customer.outlookEmail} />
            <Field label="Device Given By" value={job.givenByName} />
          </dl>
        </div>
        <div className="min-w-0">
          <SectionTitle>Device Information</SectionTitle>
          <dl>
            <Field label="PC Barcode" value={job.aucAssetBarcode} />
            <Field label="Serial Number" value={job.serialNumber} />
            <Field label="MAC Address" value={job.macAddress || "Not provided"} />
            <Field label="Hostname" value={job.hostname || "Not provided"} />
            <div>
              <dt className="text-[6pt] text-slate-400">Reported Problem</dt>
              <dd className="whitespace-pre-line break-words text-[7.5pt] leading-tight text-slate-700">
                {job.reportedProblem}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="border-t border-slate-100 px-[4mm] py-[2.5mm]">
        <SectionTitle>Equipment Handed Over</SectionTitle>
        <table className="w-full border-collapse text-[7pt]">
          <thead>
            <tr className="border-b border-slate-300 text-left text-[6pt] uppercase tracking-wide text-slate-400">
              <th className="w-[5mm] py-[0.8mm] font-medium">#</th>
              <th className="py-[0.8mm] font-medium">Item</th>
              <th className="py-[0.8mm] font-medium">Details</th>
              <th className="w-[12mm] py-[0.8mm] text-center font-medium">Received</th>
            </tr>
          </thead>
          <tbody>
            {handoverItems.map((item, i) => (
              <tr key={item.label} className="border-b border-slate-100 align-top">
                <td className="py-[1mm] text-slate-400">{i + 1}</td>
                <td className="py-[1mm] pr-[1mm] font-semibold leading-tight text-slate-900">{item.label}</td>
                <td className="break-words py-[1mm] pr-[1mm] leading-tight text-slate-600">{item.detail || "—"}</td>
                <td className="py-[1mm] text-center">
                  <span className="inline-grid h-[3.5mm] w-[3.5mm] place-items-center border border-slate-700 text-[6pt] font-bold leading-none text-slate-900">
                    ✓
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {stillHeld.length > 0 && (
          <p className="mt-[1.5mm] text-[6pt] leading-snug text-slate-500">
            Not handed over at this time (still held by MIS): {stillHeld.join(", ")}.
          </p>
        )}
      </section>

      <section className="border-t border-slate-100 px-[4mm] py-[2.5mm] text-[6.5pt] leading-snug text-slate-600">
        <p>
          I, <strong className="text-slate-900">{customerDisplayName}</strong>, confirm that I have received the
          equipment listed above from AUC MIS on the date below.
        </p>
        <div className="mt-[2mm] grid grid-cols-2 gap-[5mm]">
          <div className="min-w-0">
            <span className="block text-[6pt] text-slate-400">Released By</span>
            <strong className="block break-words text-[7pt] leading-tight text-slate-900">
              {receipt.creatorName || "Authorized staff"}
            </strong>
            <SignatureLine>Staff Signature</SignatureLine>
            <div className="mt-[5mm] border-t border-slate-300 pt-[0.5mm] text-[6pt] text-slate-400">Date</div>
          </div>
          <div className="min-w-0">
            <span className="block text-[6pt] text-slate-400">Received By (Customer)</span>
            <strong className="block break-words text-[7pt] leading-tight text-slate-900">
              {customerDisplayName}
            </strong>
            <SignatureLine>Customer Signature</SignatureLine>
            <div className="mt-[5mm] border-t border-slate-300 pt-[0.5mm] text-[6pt] text-slate-400">Date</div>
          </div>
        </div>
      </section>
    </article>
  );
}
