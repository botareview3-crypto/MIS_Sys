/**
 * Self-ping loop for Render's free tier, ported from the original app's
 * `docker-entrypoint.sh` (the `APP_BASE_URL` background loop there). On
 * Render's free tier a web service spins down after 15 minutes with no
 * *incoming* HTTP traffic and takes 30-60s to wake back up on the next
 * request — the delay/502 a visitor would otherwise hit.
 *
 * The original ran this as a `sh` background job wrapping the PHP
 * built-in server. This port uses Next.js's `instrumentation.ts` hook
 * instead: `register()` is called once when a new server instance boots
 * (Node runtime only — see the `NEXT_RUNTIME` guard below, since
 * `register()` also fires in the Edge runtime used by middleware, where
 * `setInterval`/`fetch`-forever loops don't belong). Requires
 * `experimental.instrumentationHook = true` in `next.config.ts` on
 * Next.js 14 (stable without a flag from Next.js 15 on).
 *
 * Same interval (10 minutes) and same target (`/api/health`, this app's
 * equivalent of the original's `health.php`) as the original. No-ops if
 * neither `RENDER_EXTERNAL_URL` (set automatically by Render on every web
 * service — see https://render.com/docs/environment-variables) nor the
 * `APP_BASE_URL` override is available, e.g. in local dev.
 */

const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes, matches the original's `sleep 600`
const PING_TIMEOUT_MS = 10_000; // matches the original's stream_context timeout

declare global {
  // eslint-disable-next-line no-var
  var __selfPingStarted: boolean | undefined;
}

async function pingSelf(baseUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    await fetch(new URL("/api/health", baseUrl), {
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    // Best-effort, same as the original's `|| true` — a failed self-ping
    // must never crash or block the server.
  } finally {
    clearTimeout(timeout);
  }
}

export async function register() {
  // `register()` runs in both the Node.js and Edge runtimes. The self-ping
  // loop uses `setInterval`, which has no place in the Edge runtime and
  // would otherwise register twice per server instance.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Guard against duplicate intervals if `register()` is ever invoked more
  // than once in the same process (e.g. dev-mode hot reload).
  if (globalThis.__selfPingStarted) return;

  const baseUrl = process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL;
  if (!baseUrl) return; // e.g. local dev — nothing to self-ping

  globalThis.__selfPingStarted = true;

  setInterval(() => {
    void pingSelf(baseUrl);
  }, PING_INTERVAL_MS).unref(); // .unref() so this timer alone can't keep the process alive
}
