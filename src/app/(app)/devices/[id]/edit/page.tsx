import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadDeviceForRole } from "@/lib/devices";
import { EditDeviceForm } from "@/components/devices/EditDeviceForm";
import { BackLink } from "@/components/nav/BackLink";

export default async function EditDevicePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["Admin", "Reception", "Technician"].includes(session.role)) redirect("/dashboard");

  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId) || deviceId < 1) notFound();

  const device = await loadDeviceForRole(deviceId, session);
  if (!device) notFound();

  const isRegional = !!device.customer.regionalOffice;

  return (
    <main className="p-8">
      <BackLink href={`/devices/${device.id}`} label="Back to Device Details" />
      <div className="mx-auto max-w-3xl">
        <h1 className="mt-2 text-lg font-semibold text-slate-900">Edit Device {device.jobId}</h1>
        <p className="mt-1 text-sm text-slate-500">Corrects customer and device details. Status changes happen from Work Queue.</p>
        <div className="card mt-6 p-6">
          <EditDeviceForm
            deviceId={device.id}
            isRegional={isRegional}
            initial={{
              title: device.customer.title ?? "",
              customerName: device.customer.fullName,
              phoneNumber: device.customer.phoneNumber,
              outlookEmail: device.customer.outlookEmail,
              givenByName: device.givenByName,
              aucAssetBarcode: device.aucAssetBarcode,
              serialNumber: device.serialNumber,
              macAddress: device.macAddress ?? "",
              hostname: device.hostname ?? "",
              reportedProblem: device.reportedProblem,
              expectedCompletionDate: device.expectedCompletionDate
                ? device.expectedCompletionDate.toISOString().slice(0, 10)
                : "",
              chargerReceived: device.accessories?.chargerReceived ?? false,
              networkCableBarcode: device.accessories?.networkCableBarcode ?? "",
              bagReceived: device.accessories?.bagReceived ?? false,
            }}
          />
        </div>
      </div>
    </main>
  );
}
