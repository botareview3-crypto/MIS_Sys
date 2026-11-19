import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RegisterDeviceForm } from "@/components/devices/RegisterDeviceForm";

export default async function RegisterDevicePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["Admin", "Reception", "Technician"].includes(session.role)) {
    redirect("/dashboard");
  }

  // Mirrors the assignable-users query in register-device.php: active
  // technicians, secondary admins and admins, de-duplicated by name.
  const technicians = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      role: { in: ["Technician", "Secondary Admin", "Admin"] },
    },
    select: { id: true, fullName: true, role: true },
    orderBy: { fullName: "asc" },
  });

  return (
    <main className="p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-lg font-semibold text-stone-900">Register Device</h1>
        <p className="mt-1 text-sm text-stone-500">
          Intake a device, create or reuse the customer record, and open a repair job.
        </p>
        <div className="card mt-6 p-6">
          <RegisterDeviceForm
            technicians={technicians}
            isTechnician={session.role === "Technician"}
          />
        </div>
      </div>
    </main>
  );
}
