import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AssignTechnicianForm } from "@/components/repairs/AssignTechnicianForm";

export default async function AssignTechnicianPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "Admin") redirect("/dashboard");

  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId) || deviceId < 1) notFound();

  const [device, technicians, secondaryAdmins] = await Promise.all([
    prisma.repairJob.findUnique({ where: { id: deviceId }, include: { customer: true, technician: true } }),
    prisma.user.findMany({
      where: { role: { in: ["Technician", "Admin"] }, isActive: true, deletedAt: null },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "Admin", isMainAdmin: false, isActive: true, deletedAt: null },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);
  if (!device) notFound();

  return (
    <main className="p-8">
      <div className="mx-auto max-w-lg">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Job {device.jobId}</p>
        <h1 className="text-lg font-semibold text-slate-900">Assign Technician</h1>
        <p className="mt-1 text-sm text-slate-500">
          {device.customer.fullName} · currently {device.technician?.fullName ?? "unassigned"}
        </p>

        <div className="card mt-6 p-6">
          <AssignTechnicianForm
            deviceId={device.id}
            technicians={technicians}
            secondaryAdmins={secondaryAdmins}
            currentTechnicianId={device.assignedTechnicianId}
            currentSecondaryAdminId={device.assignedSecondaryAdminId}
          />
        </div>
      </div>
    </main>
  );
}
