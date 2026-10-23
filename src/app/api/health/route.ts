import { NextResponse } from "next/server";

/**
 * Bare-bones keep-alive target, ported from the original app's
 * `health.php`. Deliberately does no DB work — just a plain 200 — so it's
 * cheap to hit every few minutes from an external uptime pinger
 * (cron-job.org, UptimeRobot, Render's own health checks, etc.). The app no
 * longer pings itself (self-ping removed 2026-10-23).
 *
 * On Render's free tier a web service spins down after 15 minutes with no
 * *incoming* HTTP traffic and takes 30-60s to wake back up on the next
 * real request. Pinging this endpoint on a shorter interval than that
 * keeps the service warm.
 */
export async function GET() {
  return new NextResponse("ok", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}
