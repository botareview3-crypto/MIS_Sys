import { redirect } from "next/navigation";
import { HardDriveDownload, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Replaces app/pages/maintenance/system-backups.php. That version wrote
 * versioned .aucbackup archives to local disk and kept a browsable history
 * of the last 30. This rewrite is on-demand only: Render's free-tier
 * filesystem is ephemeral (no persistent disk), so anything saved to disk
 * would vanish on the next deploy/restart — and Neon already runs its own
 * automated backups independently of this app. Clicking the button below
 * builds a fresh backup in memory and downloads it immediately; nothing is
 * kept server-side, so there's no history list here.
 */
export default async function SystemBackupsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "Admin") redirect("/dashboard");

  const [userCount, repairJobCount, customerCount] = await Promise.all([
    prisma.user.count(),
    prisma.repairJob.count(),
    prisma.customer.count(),
  ]);

  return (
    <main className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            System Maintenance
          </p>
          <h1 className="mt-1 text-lg font-semibold text-stone-900">Database Backup</h1>
          <p className="mt-1 max-w-xl text-sm text-stone-500">
            Generate an on-demand export of every table in the database as SQL insert
            statements, zipped with a manifest. Nothing is stored on the server — the
            file is built fresh and downloaded directly to your browser.
          </p>
        </div>
        <span className="text-xs font-bold uppercase tracking-wide text-stone-400">Admin Access Only</span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "System Users", value: userCount },
          { label: "Repair Jobs", value: repairJobCount },
          { label: "Customers", value: customerCount },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-2xl font-bold text-stone-900">{s.value}</p>
            <p className="mt-1 text-xs font-medium text-stone-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card mt-6 flex flex-col items-start gap-4 p-6">
        <div className="flex items-center gap-3">
          <HardDriveDownload className="text-brand-600" size={28} aria-hidden />
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Create &amp; Download Backup</h2>
            <p className="mt-1 text-xs text-stone-500">
              Every table, in dependency-safe order, as a single .zip. Takes a few
              seconds for larger tables.
            </p>
          </div>
        </div>
        <a href="/api/system/backup" className="btn-primary">
          Download Backup
        </a>
      </div>

      <div className="card mt-6 flex items-start gap-3 p-5">
        <ShieldCheck className="mt-0.5 shrink-0 text-stone-300" size={22} aria-hidden />
        <p className="text-xs text-stone-500">
          Neon (the database host) also runs its own automated backups and
          point-in-time recovery independently of this page — this export is a
          convenience for the admin team, not the only safeguard.
        </p>
      </div>
    </main>
  );
}
