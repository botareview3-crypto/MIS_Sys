import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AddUserForm } from "@/components/users/AddUserForm";
import { BackLink } from "@/components/nav/BackLink";

export default async function AddUserPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "Admin") redirect("/dashboard");

  return (
    <main className="p-8">
      <BackLink href="/users" label="Back to Manage Users" />
      <div className="mx-auto max-w-lg">
        <h1 className="mt-2 text-lg font-semibold text-stone-900">Add User</h1>
        <p className="mt-1 text-sm text-stone-500">Create a new system account.</p>
        <div className="card mt-6 p-6">
          <AddUserForm />
        </div>
      </div>
    </main>
  );
}
