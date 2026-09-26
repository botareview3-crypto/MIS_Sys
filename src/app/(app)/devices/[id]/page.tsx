import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { loadDeviceForRole } from "@/lib/devices";
import { manufacturerLookup } from "@/lib/device-manufacturer";
import { DeleteDeviceButton } from "@/components/devices/DeleteDeviceButton";
import { RevealOutlookPasswordButton } from "@/components/devices/RevealOutlookPasswordButton";

function fmt(d: Date | null) {
  if (!d) return "—";
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export default async function ViewDevicePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId) || deviceId < 1) notFound();

  const device = await loadDeviceForRole(deviceId, session);
  if (!device) notFound();

  const lookup = manufacturerLookup(device.serialNumber);

  const canEdit = ["Admin", "Reception", "Technician"].includes(session.role);
  const canDelete = ["Admin", "Technician"].includes(session.role);

  return (
    <main className="p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Job {device.jobId}</p>
            <h1 className="text-lg font-semibold text-slate-900">{device.customer.fullName}</h1>
            <span className="mt-1 inline-block rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
              {device.status}
            </span>
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <Link href={`/devices/${device.id}/edit`} className="btn-primary">
                Edit
              </Link>
            )}
            {canDelete && <DeleteDeviceButton deviceId={device.id} jobId={device.jobId} />}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">Customer</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Name" value={`${device.customer.title ?? ""} ${device.customer.fullName}`.trim()} />
              <Row label="Phone" value={device.customer.phoneNumber} />
              <Row label="Outlook email" value={device.customer.outlookEmail} />
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Outlook password</dt>
                <dd className="text-right">
                  <RevealOutlookPasswordButton deviceId={device.id} />
                </dd>
              </div>
              {device.customer.regionalOffice && <Row label="Regional office" value={device.customer.regionalOffice} />}
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">Device</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="AUC barcode" value={device.aucAssetBarcode} />
              <Row label="Serial number" value={device.serialNumber} />
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Manufacturer</dt>
                <dd className="text-right text-slate-700">
                  {lookup.manufacturer}
                  {lookup.productNumber && ` · ${lookup.productNumber}`}{" "}
                  <Link href={`/devices/${device.id}/manufacturer`} className="text-brand-600 hover:underline">
                    Find more
                  </Link>
                </dd>
              </div>
              <Row label="MAC address" value={device.macAddress ?? "—"} />
              <Row label="Hostname" value={device.hostname ?? "—"} />
              <Row label="Given by" value={device.givenByName} />
              <Row
                label="Technician"
                value={device.technician?.fullName ?? device.secondaryAdmin?.fullName ?? "Unassigned"}
              />
              <Row label="Expected completion" value={device.expectedCompletionDate ? fmt(device.expectedCompletionDate) : "—"} />
            </dl>
          </section>

          <section className="card p-5 col-span-2">
            <h2 className="text-sm font-semibold text-slate-900">Reported problem</h2>
            <p className="mt-2 text-sm text-slate-600">{device.reportedProblem}</p>
            {device.technicianDiagnosis && (
              <>
                <h3 className="mt-4 text-sm font-semibold text-slate-900">Technician diagnosis</h3>
                <p className="mt-2 text-sm text-slate-600">{device.technicianDiagnosis}</p>
              </>
            )}
            {device.repairNotes && (
              <>
                <h3 className="mt-4 text-sm font-semibold text-slate-900">Repair notes</h3>
                <p className="mt-2 text-sm text-slate-600">{device.repairNotes}</p>
              </>
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">Accessories</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Charger" value={device.accessories?.chargerReceived ? "Received" : "Not received"} />
              <Row label="Bag" value={device.accessories?.bagReceived ? "Received" : "Not received"} />
              <Row label="Network cable" value={device.accessories?.networkCableBarcode ?? "—"} />
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">Timeline</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Received" value={fmt(device.receivedAt)} />
              <Row label="Ready" value={fmt(device.readyAt)} />
              <Row label="Delivered" value={fmt(device.deliveredAt)} />
            </dl>
          </section>

          <section className="card col-span-2 p-5">
            <h2 className="text-sm font-semibold text-slate-900">Status history</h2>
            {device.statusHistory.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">No status changes recorded.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {device.statusHistory.map((h: (typeof device.statusHistory)[number]) => (
                  <li key={h.id} className="border-b border-slate-100 pb-2 last:border-0">
                    <span className="font-medium text-slate-900">
                      {h.previousStatus ?? "—"} → {h.newStatus}
                    </span>{" "}
                    <span className="text-slate-400">
                      by {h.changedByUser.fullName} · {fmt(h.changedAt)}
                    </span>
                    {h.changeNote && <p className="text-slate-500">{h.changeNote}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card col-span-2 p-5">
            <h2 className="text-sm font-semibold text-slate-900">Receipts</h2>
            {device.receipts.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Generated receipts will appear here.</p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm">
                {device.receipts.map((r: (typeof device.receipts)[number]) => (
                  <li key={r.id} className="flex items-center justify-between gap-4 border-b border-slate-100 py-1.5 last:border-0">
                    <span>
                      {r.receiptType} · {r.receiptReference}
                      {r.printCount > 0 && (
                        <span className="ml-2 text-xs text-slate-400">(printed {r.printCount}×)</span>
                      )}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-slate-400">{fmt(r.generatedAt)}</span>
                      {["Admin", "Reception", "Technician"].includes(session.role) && (
                        <Link href={`/receipts/${r.id}`} className="text-brand-600 hover:underline">
                          Preview
                        </Link>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card col-span-2 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">WhatsApp messages</h2>
              {["Received", "Ready", "Delivered"].includes(device.status) && (
                <Link
                  href={`/devices/${device.id}/whatsapp?type=${device.status}`}
                  className="btn-primary bg-emerald-600 px-3 py-1.5 text-xs hover:bg-emerald-700"
                >
                  Prepare {device.status} Message
                </Link>
              )}
            </div>
            {device.whatsappLogs.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">No WhatsApp messages prepared yet.</p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm">
                {device.whatsappLogs.map((w: (typeof device.whatsappLogs)[number]) => (
                  <li key={w.id} className="flex justify-between border-b border-slate-100 py-1.5 last:border-0">
                    <span>
                      {w.messageType} · {w.messageStatus}
                    </span>
                    <span className="text-slate-400">{fmt(w.preparedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
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
