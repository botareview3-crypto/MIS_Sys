/**
 * Shared building blocks for the printable A6 sheets (ReceiptDocument and
 * HandoverForm). Printables are a quarter of an A4 page - A6, 105 x 148 mm,
 * portrait - so everything here is sized in mm/pt rather than screen rem.
 * The page size itself is set by the @page rule in src/app/globals.css.
 *
 * Plain server-renderable components (no hooks) - no "use client".
 */

export function fmtDateTime(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function SheetHeader({
  subtitle,
  reference,
  generatedAt,
}: {
  subtitle: string;
  reference: string;
  generatedAt: Date;
}) {
  return (
    <header className="flex items-start justify-between gap-[2mm] bg-gradient-to-br from-slate-900 via-slate-800 to-brand-700 px-[4mm] py-[2.5mm] text-white print:bg-slate-900 print:text-white print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
      <div className="flex min-w-0 items-center gap-[2mm]">
        <div className="grid h-[8mm] w-[8mm] flex-shrink-0 place-items-center rounded-full border border-white/40 bg-white/10 text-[7pt] font-black tracking-wide">
          AU
        </div>
        <div className="min-w-0">
          <p className="text-[5.5pt] font-bold uppercase tracking-widest text-white/70">African Union Commission</p>
          <h1 className="text-[8.5pt] font-semibold leading-tight">MIS Repair Management System</h1>
          <p className="text-[6.5pt] text-white/80">{subtitle}</p>
        </div>
      </div>
      <div className="max-w-[32mm] shrink-0 text-right">
        <span className="block text-[5.5pt] uppercase tracking-wide text-white/70">Receipt Reference</span>
        <strong className="block break-all text-[7.5pt] leading-tight">{reference}</strong>
        <small className="block text-[5.5pt] leading-tight text-white/70">Generated: {fmtDateTime(generatedAt)}</small>
      </div>
    </header>
  );
}

/** Three-up strip of key facts under the header. */
export function MetaStrip({ items }: { items: { label: string; value: string }[] }) {
  return (
    <section className="grid grid-cols-3 gap-[2mm] border-b border-slate-100 bg-slate-50 px-[4mm] py-[1.5mm]">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <span className="block text-[6pt] text-slate-400">{item.label}</span>
          <strong className="block break-words text-[7pt] leading-tight text-slate-900">{item.value}</strong>
        </div>
      ))}
    </section>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-[1.5mm] text-[7.5pt] font-semibold text-slate-900">{children}</h2>;
}

/** Two-column "label  value" list; put <Field> rows inside. Far shorter than stacked label-over-value. */
export function FieldList({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-[16mm_1fr] gap-x-[1.5mm] gap-y-[0.8mm]">{children}</dl>;
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[6pt] text-slate-400">{label}</dt>
      <dd className="min-w-0 whitespace-pre-line text-[7pt] text-slate-700 [overflow-wrap:anywhere]">{value}</dd>
    </>
  );
}

export function SignatureLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-[6mm] border-t border-slate-300 pt-[0.5mm] text-[6pt] text-slate-400">{children}</div>
  );
}

/** Signature line with a Date line beside it (same row, so the sheet stays short). */
export function SignatureAndDate({ signatureLabel }: { signatureLabel: string }) {
  return (
    <div className="mt-[6mm] grid grid-cols-[1fr_13mm] gap-[2mm] text-[6pt] text-slate-400">
      <div className="border-t border-slate-300 pt-[0.5mm]">{signatureLabel}</div>
      <div className="border-t border-slate-300 pt-[0.5mm]">Date</div>
    </div>
  );
}
