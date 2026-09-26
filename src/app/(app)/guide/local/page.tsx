import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// Split from the shared /guide placeholder on 2026-09-26 — Local and Intra
// are meant to get their own guide content later; this is the Local half.
export default async function LocalGuidePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="p-8">
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Local Guide</h1>
        <p className="mt-1 text-sm text-slate-500">Content coming later.</p>
      </div>
    </main>
  );
}
