import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EditUserForm } from "@/components/users/EditUserForm";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "Admin") redirect("/dashboard");

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId < 1) notFound();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) notFound();

  return (
    <main className="p-8">
      <div className="mx-auto max-w-lg">
        <h1 className="text-lg font-semibold text-slate-900">Edit {user.fullName}</h1>
        <p className="mt-1 text-sm text-slate-500">@{user.username}</p>
        <div className="card mt-6 p-6">
          <EditUserForm
            userId={user.id}
            initial={{ fullName: user.fullName, username: user.username, role: user.role }}
          />
        </div>
      </div>
    </main>
  );
}
