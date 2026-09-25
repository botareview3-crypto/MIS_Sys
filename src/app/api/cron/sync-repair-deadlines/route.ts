import { NextRequest, NextResponse } from "next/server";
import { syncRepairDeadlines } from "@/lib/repair-deadlines";

/**
 * Scheduled trigger for syncRepairDeadlines() (ported from
 * includes/repair-deadlines.php's overdue-notification generator).
 *
 * Architecture decision (docs/status.md item, flagged per project owner's
 * request rather than asked about blind): the original ran this as a
 * synchronous side effect on every authenticated page load
 * (includes/auth.php:106 calls it inside the shared auth-check include).
 * This port exposes it instead as a standalone, secret-protected HTTP
 * endpoint meant to be hit on a schedule — NOT wired into page loads or
 * middleware. Reasoning:
 *   - CLAUDE.md already notes the Node/Docker/Railway deployment config for
 *     this app doesn't exist yet ("original Dockerfile/railway.json need a
 *     Node equivalent, not yet written"). Railway's native Cron Job feature
 *     is a separate *service* that needs that config to model itself on —
 *     there's nothing to attach it to yet, so building toward it now would
 *     be building on a foundation that isn't there.
 *   - An HTTP endpoint has zero deployment dependencies: it works today,
 *     and slots into whatever scheduler ends up wired up later — a Railway
 *     Cron Job service hitting this URL with curl, an external scheduler
 *     (e.g. a scheduled GitHub Actions workflow, cron-job.org), or anything
 *     else — without the route itself needing to change.
 *   - Tying it to page loads (matching the original 1:1) was considered and
 *     rejected: it would add a notifications-table read/write to every
 *     authenticated request, forever, for a check that only needs to run
 *     once in a while — and it still wouldn't fire on days nobody logs in,
 *     which is exactly when an unattended job is most likely to go
 *     overdue unnoticed.
 *
 * IMPORTANT — this endpoint does nothing until something calls it on a
 * schedule. That trigger doesn't exist yet and is an infra step outside
 * this codebase: set CRON_SECRET in the deployment environment, then point
 * a scheduler (Railway Cron Job, GitHub Actions cron, cron-job.org, etc.)
 * at this URL, e.g. once daily, with either an
 * `Authorization: Bearer <CRON_SECRET>` header or a `?secret=<CRON_SECRET>`
 * query param (kept as a fallback since some free schedulers can't set
 * custom headers).
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const queryToken = req.nextUrl.searchParams.get("secret");
  const providedToken = headerToken ?? queryToken;

  if (providedToken !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await syncRepairDeadlines();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // Deliberate deviation from the original here: the PHP version catches
    // PDOException and only error_log()s it, never failing the page load it
    // rides along on. This route IS the whole operation, so a failure
    // should be visible to whatever's calling it on a schedule (so
    // monitoring/alerting on the scheduler side can catch it) rather than
    // silently swallowed.
    console.error("Repair deadline synchronization failed:", err);
    return NextResponse.json({ ok: false, error: "Synchronization failed." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
