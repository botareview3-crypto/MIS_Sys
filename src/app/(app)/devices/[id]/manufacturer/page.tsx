import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { loadDeviceForRole } from "@/lib/devices";
import { manufacturerLookup } from "@/lib/device-manufacturer";

/**
 * Ported from app/pages/devices/manufacturer-info.php +
 * includes/device-manufacturer.php. Same lookup logic and HP special-case
 * (HP's own support/warranty/parts URLs instead of a generic search link),
 * same identifiers shown (serial, product number, warranty label, AUC
 * asset barcode).
 *
 * Simplified vs. the original: this port reuses the app's existing card/
 * Tailwind design system instead of the original's bespoke gradient-hero
 * CSS block, and drops the copy-to-clipboard buttons (the values are
 * short enough to select by hand; not a functional loss, just less UI to
 * maintain) — same "simplification, same information, lighter UI"
 * precedent as other ported pages (see commit-log).
 */
export default async function ManufacturerInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId) || deviceId < 1) notFound();

  const device = await loadDeviceForRole(deviceId, session);
  if (!device) notFound();

  const lookup = manufacturerLookup(device.serialNumber);
  const isHp = lookup.manufacturer.toLowerCase() === "hp";

  const officialProductUrl = isHp ? "https://support.hp.com/us-en/products?openCLC=true" : lookup.url;
  const officialWarrantyUrl = isHp ? "https://support.hp.com/us-en/check-warranty" : lookup.url;
  const officialPartsUrl = isHp ? "https://partsurfer.hp.com/partsurfer" : lookup.url;

  return (
    <main className="p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href={`/devices/${device.id}`} className="text-sm text-slate-500 hover:text-slate-700">
            ← Back to device
          </Link>
          <h1 className="mt-2 text-lg font-semibold text-slate-900">
            {lookup.manufacturer} device · {device.jobId}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            The scanned label has been separated into the correct fields before opening manufacturer support.
          </p>
        </div>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900">Verified device identifiers</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Serial number" value={lookup.serial} />
            {lookup.productNumber !== "" && <Row label="Product number" value={lookup.productNumber} />}
            {lookup.warrantyCode !== "" && <Row label="Warranty label" value={lookup.warrantyCode} />}
            {device.aucAssetBarcode && <Row label="AUC asset barcode" value={device.aucAssetBarcode} />}
          </dl>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900">Official support actions</h2>
          <p className="mt-1 text-sm text-slate-500">Use the serial and product number above on the manufacturer page.</p>
          <div className="mt-4 grid gap-2">
            <SupportAction
              href={officialProductUrl}
              title="Identify product"
              description="Model, specifications, drivers and manuals"
            />
            <SupportAction
              href={officialWarrantyUrl}
              title="Check warranty"
              description="Open the official warranty checker"
            />
            <SupportAction href={officialPartsUrl} title="Find parts" description="Search the official parts catalogue" />
          </div>
        </section>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right text-slate-700">{value}</dd>
    </div>
  );
}

function SupportAction({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm hover:border-brand-300 hover:bg-brand-50"
    >
      <span>
        <span className="block font-medium text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
      <span aria-hidden className="text-slate-400">
        →
      </span>
    </a>
  );
}
