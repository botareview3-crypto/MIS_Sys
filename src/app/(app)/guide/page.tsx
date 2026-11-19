import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// Intentionally blank for now — project owner asked to add the Guide entry
// under both Local and Intra so the tab exists, content to follow later.
export default async function GuidePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="p-8">
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Guide</h1>
        <p className="mt-1 text-sm text-slate-500">
          Content coming later.
        </p>
      </div>
    </main>
  );
}
