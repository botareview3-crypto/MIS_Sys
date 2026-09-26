import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfilePhotoForm } from "@/components/profile/ProfilePhotoForm";

function initialsOf(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Ported from app/pages/users/profile.php. Every role can reach this — it's just the signed-in user's own account. */
export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");

  return (
    <main className="p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Personal Account</p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">My Profile</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Keep your staff photo current so colleagues can quickly identify who is using the system.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-3">
        <div className="bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Full Name</p>
          <p className="mt-1 break-words text-sm font-bold text-slate-900">{user.fullName}</p>
        </div>
        <div className="bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Username</p>
          <p className="mt-1 break-words text-sm font-bold text-slate-900">{user.username}</p>
        </div>
        <div className="bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">System Role</p>
          <p className="mt-1 break-words text-sm font-bold text-slate-900">{user.role}</p>
        </div>
      </div>

      <ProfilePhotoForm initials={initialsOf(user.fullName)} profileImagePath={user.profileImagePath} />
    </main>
  );
}
