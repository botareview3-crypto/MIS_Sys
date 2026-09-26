import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import WhatsappStatusPanel from "@/components/settings/WhatsappStatusPanel";

/**
 * One-time (and re-pairing, if it ever disconnects) QR scan for the
 * whatsapp-web.js session that auto-sends Received/Ready messages. Admin
 * only. The paired session itself is stored in Postgres (`whatsapp_sessions`
 * table via RemoteAuth), not on local disk — see src/lib/whatsapp-client.ts.
 */
export default async function WhatsappSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "Admin") redirect("/dashboard");

  return (
    <main className="p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        System Maintenance
      </p>
      <h1 className="mt-1 text-lg font-semibold text-slate-900">WhatsApp Auto-Send Setup</h1>
      <p className="mt-1 max-w-xl text-sm text-slate-500">
        Pair the phone number that sends automatic Received and Ready messages. Scan once
        here — the pairing then persists in the database and survives restarts, so this page
        is only needed again if the connection is ever lost.
      </p>
      <div className="mt-6 max-w-md">
        <WhatsappStatusPanel />
      </div>
    </main>
  );
}
