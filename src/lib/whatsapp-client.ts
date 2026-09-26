/**
 * Real WhatsApp sending, via whatsapp-web.js (unofficial — automates a
 * regular WhatsApp account through a headless browser). This is NOT the
 * Meta Cloud API: no access token, no approved templates, no per-message
 * cost. Decision made 2026-09-26: user wants auto-send at zero cost and
 * accepted the ToS/ban-risk tradeoff on a dedicated second number.
 *
 * Session persistence: whatsapp-web.js's default LocalAuth strategy writes
 * the paired session to a local folder, which does NOT survive Render's
 * free-tier ephemeral filesystem (wiped on every deploy/restart — same
 * constraint already documented in system-backups/page.tsx). Instead this
 * uses the RemoteAuth strategy with a custom store (PrismaWhatsappStore
 * below) that reads/writes the session as a single blob in the
 * `whatsapp_sessions` Postgres table, so pairing survives restarts without
 * needing a paid Render disk.
 *
 * One singleton client per server process, kept on `globalThis` so
 * Next.js dev-mode hot reload doesn't spin up a second headless Chrome.
 */

import { Client, RemoteAuth } from "whatsapp-web.js";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";

const SESSION_NAME = "mis-whatsapp";
// RemoteAuth's minimum accepted interval is 60_000ms; this just controls
// how often the *backup* re-syncs while already connected, not pairing time.
const BACKUP_SYNC_INTERVAL_MS = 5 * 60 * 1000;

export type WhatsappConnectionStatus =
  | "initializing"
  | "qr"
  | "authenticated"
  | "ready"
  | "disconnected"
  | "error";

type WhatsappState = {
  status: WhatsappConnectionStatus;
  qrDataUrl: string | null;
  lastError: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __whatsappClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __whatsappState: WhatsappState | undefined;
}

/**
 * Implements the store contract whatsapp-web.js's RemoteAuth expects:
 * sessionExists / save / extract / delete, keyed by session name. `save`
 * and `extract` exchange a local zip file path with the caller — RemoteAuth
 * itself handles zipping/unzipping the Puppeteer profile, we just move the
 * resulting bytes to and from Postgres. See wwebjs.dev's RemoteAuth guide
 * (community-documented interface; this is an unofficial library, so this
 * contract can change between major versions).
 */
class PrismaWhatsappStore {
  async sessionExists({ session }: { session: string }): Promise<boolean> {
    const row = await prisma.whatsappSession.findUnique({ where: { id: session } });
    return !!row;
  }

  async save({ session }: { session: string }): Promise<void> {
    const fs = await import("fs/promises");
    const data = await fs.readFile(`${session}.zip`);
    await prisma.whatsappSession.upsert({
      where: { id: session },
      create: { id: session, data },
      update: { data },
    });
  }

  async extract({ session, path }: { session: string; path: string }): Promise<void> {
    const fs = await import("fs/promises");
    const row = await prisma.whatsappSession.findUnique({ where: { id: session } });
    if (!row) throw new Error("No stored WhatsApp session found to extract.");
    await fs.writeFile(path, row.data);
  }

  async delete({ session }: { session: string }): Promise<void> {
    await prisma.whatsappSession.deleteMany({ where: { id: session } });
  }
}

function getState(): WhatsappState {
  if (!globalThis.__whatsappState) {
    globalThis.__whatsappState = { status: "initializing", qrDataUrl: null, lastError: null };
  }
  return globalThis.__whatsappState;
}

/**
 * Lazily creates (once per server process) and returns the shared
 * whatsapp-web.js client, starting the connect/pairing flow on first call.
 */
export function getWhatsappClient(): Client {
  if (globalThis.__whatsappClient) return globalThis.__whatsappClient;

  const state = getState();

  // Everything below used to fail silently into `state` only, with nothing
  // printed to stdout — meaning a Puppeteer/Chromium crash or a missing
  // Chrome binary on Render would never show up in the deploy log stream,
  // only in the (auth-gated) /api/whatsapp/status response. Every branch
  // now also console.error's/console.log's, so `render logs` actually
  // shows what's happening during pairing.
  let client: Client;
  try {
    client = new Client({
      authStrategy: new RemoteAuth({
        clientId: SESSION_NAME,
        store: new PrismaWhatsappStore(),
        backupSyncIntervalMs: BACKUP_SYNC_INTERVAL_MS,
      }),
      puppeteer: {
        headless: true,
        args: [
          // Required for Chromium to run in Render's container (no sandbox
          // permissions available, and the process may run as root).
          "--no-sandbox",
          "--disable-setuid-sandbox",
          // Render's containers have a tiny /dev/shm; Chromium's default
          // shared-memory usage overflows it under load and the browser
          // dies mid-session — a very common cause of a QR that scans on
          // the phone but then fails to link. This forces Chromium to use
          // /tmp instead.
          "--disable-dev-shm-usage",
        ],
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to construct the WhatsApp client.";
    console.error("[whatsapp] Client construction failed:", message);
    state.status = "error";
    state.lastError = message;
    // Rethrow: there's no client to return or cache here.
    throw err;
  }

  client.on("qr", (qr) => {
    console.log("[whatsapp] QR code received, rendering data URL.");
    state.status = "qr";
    QRCode.toDataURL(qr)
      .then((dataUrl) => {
        state.qrDataUrl = dataUrl;
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to render QR code.";
        console.error("[whatsapp] QR render failed:", message);
        state.lastError = message;
      });
  });

  client.on("authenticated", () => {
    console.log("[whatsapp] Authenticated.");
    state.status = "authenticated";
    state.qrDataUrl = null;
    state.lastError = null;
  });

  client.on("ready", () => {
    console.log("[whatsapp] Ready.");
    state.status = "ready";
    state.qrDataUrl = null;
    state.lastError = null;
  });

  client.on("disconnected", (reason) => {
    const message = typeof reason === "string" ? reason : "WhatsApp session disconnected.";
    console.error("[whatsapp] Disconnected:", message);
    state.status = "disconnected";
    state.qrDataUrl = null;
    state.lastError = message;
  });

  client.on("auth_failure", (message) => {
    const text = typeof message === "string" ? message : "WhatsApp authentication failed.";
    console.error("[whatsapp] Auth failure:", text);
    state.status = "error";
    state.lastError = text;
  });

  console.log("[whatsapp] Calling client.initialize()...");
  client.initialize().catch((err) => {
    const message = err instanceof Error ? err.message : "Failed to start the WhatsApp client.";
    console.error("[whatsapp] initialize() rejected:", message, err instanceof Error ? err.stack : "");
    state.status = "error";
    state.lastError = message;
  });

  globalThis.__whatsappClient = client;
  return client;
}

/** Ensures the client has been started, then returns its current state for the pairing/status page. */
export function getWhatsappStatus(): WhatsappState {
  try {
    getWhatsappClient();
  } catch {
    // getWhatsappClient() already logged and set state.status/lastError
    // before rethrowing (e.g. Client construction failed outright) — fall
    // through and return that state instead of letting this throw crash
    // the /api/whatsapp/status route.
  }
  return getState();
}

/**
 * Sends a plain-text WhatsApp message to a normalized phone number (digits
 * only, e.g. "251911223344" — no "+", no "@c.us" suffix, see
 * normalizePhoneForWhatsapp() in src/lib/whatsapp.ts). Never throws — callers
 * (auto-send flows) must not fail the request that triggered them just
 * because WhatsApp is disconnected or a send failed.
 */
export async function sendWhatsappTextMessage(
  normalizedPhone: string,
  message: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const state = getState();
  if (state.status !== "ready") {
    return { ok: false, error: `WhatsApp is not connected (status: ${state.status}).` };
  }
  try {
    const client = getWhatsappClient();
    await client.sendMessage(`${normalizedPhone}@c.us`, message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to send WhatsApp message." };
  }
}
