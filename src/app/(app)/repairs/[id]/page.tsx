import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadDeviceForRole } from "@/lib/devices";
import { UpdateRepairForm } from "@/components/repairs/UpdateRepairForm";

export default async function UpdateRepairPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["Admin", "Secondary Admin", "Technician"].includes(session.role)) redirect("/dashboard");

  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId) || deviceId < 1) notFound();

  const device = await loadDeviceForRole(deviceId, session);
  if (!device) notFound();

  return (
    <main className="p-8">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Job {device.jobId}</p>
        <h1 className="text-lg font-semibold text-slate-900">{device.customer.fullName}</h1>
        <p className="mt-1 text-sm text-slate-500">{device.reportedProblem}</p>

        <div className="card mt-6 p-6">
          <UpdateRepairForm
            deviceId={device.id}
            initial={{
              technicianDiagnosis: device.technicianDiagnosis ?? "",
              repairNotes: device.repairNotes ?? "",
              status: device.status,
              expectedCompletionDate: device.expectedCompletionDate
                ? device.expectedCompletionDate.toISOString().slice(0, 10)
                : "",
              chargerReceived: device.accessories?.chargerReceived ?? false,
              chargerReturned: device.accessories?.chargerReturned ?? false,
              networkCableReceived: !!device.accessories?.networkCableBarcode,
              networkCableReturned: device.accessories?.networkCableReturned ?? false,
              bagReceived: device.accessories?.bagReceived ?? false,
              bagReturned: device.accessories?.bagReturned ?? false,
            }}
          />
        </div>
      </div>
    </main>
  );
}
