# Commit Log

Append one entry per work session/commit. Newest at the top.

---

## 2026-09-26 (24) — Fix: Puppeteer Chrome cache lands outside Render's deployed project folder

**Scope:** Session 23's fix (`npx puppeteer browsers install chrome` in
the build command) did make Chrome download successfully — confirmed in
the build log: `chrome@146.0.7680.31
/opt/render/.cache/puppeteer/chrome/linux-146.0.7680.31/chrome-linux64/chrome`,
followed by a clean `Build successful`. But the WhatsApp Setup page still
hit the identical "Could not find Chrome" error afterward, same version
number.

**Diagnosis:** confirmed against Puppeteer's own docs, which name Render
specifically: *"If you deploy a project using Puppeteer to a hosting
provider, such as Render or Heroku, you might need to reconfigure the
location of the cache to be within your project folder... because not all
hosting providers include `$HOME/.cache` into the project's deployment."*
Puppeteer's default cache dir is `$HOME/.cache/puppeteer`
(`/opt/render/.cache/puppeteer` here). Render's build log shows an
`Uploading build...` step right after `next build` finishes — that step
only packages the project directory (`/opt/render/project/src`), not
arbitrary paths under `$HOME`. So Chrome genuinely did download during the
build, into a location that then never made it into the running instance.
Also a matching, well-known upstream report:
https://github.com/puppeteer/puppeteer/issues/9694 ("Puppeteer fails to
find Chromium on Render.com") — same exact error text.

**Fix:** added `.puppeteerrc.cjs` at the repo root (Puppeteer's own
documented mechanism for this exact scenario), setting
`cacheDirectory: join(__dirname, ".cache", "puppeteer")` — i.e. inside the
project folder instead of `$HOME`. This file is read automatically both by
the `npx puppeteer browsers install chrome` CLI step (build time) and by
`puppeteer.launch()` inside whatsapp-web.js's `Client` (runtime), so both
now agree on the same project-relative path, and that path is what Render
actually carries from build into the running instance. `render.yaml`'s
`buildCommand` itself didn't need to change for this.

**Changed:**
- `.puppeteerrc.cjs` (new) — cache-directory override, with an inline
  comment explaining why.
- `.gitignore` — added `.cache/` so the downloaded Chrome binary is never
  accidentally committed if this is ever run/built locally.
- `render.yaml` — comment expanded to note the cache-location fix and
  point at `.puppeteerrc.cjs`.

**Not verified:** same standing limitation as sessions 20/23 — this
sandbox has no network access to actually run
`npx puppeteer browsers install chrome` or `next start` and confirm Chrome
gets found at runtime. Watch the next build log for the same
`chrome@146.0.7680.31 ...` download line (should still appear — the
config file changes *where* it downloads to, not whether it downloads),
then re-check the WhatsApp Setup page.

---

## 2026-09-26 (23) — Fix: Puppeteer can't find Chrome on Render

**Scope:** After session 22's revert unblocked deploys, the WhatsApp Setup
page moved past the missing-table error and reached the actual pairing
flow — then failed with Puppeteer's own error: `Could not find Chrome
(ver. 146.0.7680.31)`, pointing at `/opt/render/.cache/puppeteer` and
suggesting `npx puppeteer browsers install chrome`.

**Diagnosis:** Puppeteer (a transitive dependency of whatsapp-web.js, not
listed directly in `package.json`) downloads its Chrome binary via a
`postinstall` script the first time it's installed. That binary lands
outside `node_modules` (default: `~/.cache/puppeteer`, i.e.
`/opt/render/.cache/puppeteer` on Render). Render caches `node_modules`
between builds for speed — every build log since session 19 has shown
`up to date, audited 360 packages`, meaning npm considers the dependency
tree already satisfied and skips re-running `postinstall` scripts
entirely. So the Chrome download likely only ever ran (if at all) on
whichever build first added `whatsapp-web.js`/`puppeteer` to
`package.json`, and that cache directory isn't part of what carries
forward — so by the time any later build's instance actually runs, Chrome
isn't there. Same underlying ephemeral-storage issue session 19 already
solved for the WhatsApp session blob itself (RemoteAuth + Postgres instead
of local disk); this is the same problem hitting a different unmanaged
directory.

**Fix:** added `npx puppeteer browsers install chrome` as its own explicit
build step, between `npm install` and `npm run build`, so it always runs
regardless of npm's install-skip decision — not reliant on `postinstall`
at all.

**Changed:**
- `render.yaml` — `buildCommand` updated to
  `npm install --include=dev && npx puppeteer browsers install chrome && npm run build`.
  Comment also documents the session-22 `db push` removal for continuity
  (both changes touch the same line's history).
- Project owner needs to make the matching edit in the Render dashboard's
  Build Command field directly (confirmed in session 21 that this field
  does not auto-sync from `render.yaml`).

**Not verified:** no way to confirm the Chrome download actually
succeeds and the pairing QR renders without a real Render deploy — this
sandbox has no network access to test `npx puppeteer browsers install
chrome` locally either. Watch the next build log for the download step
and re-check the WhatsApp Setup page after deploy.

**Flagged, not addressed here:** this adds a real, recurring cost to every
future build (a ~200MB Chrome download that previously silently wasn't
happening at all) — on top of the ~300MB Puppeteer/Chromium weight already
flagged in session 19. Worth watching Render's free-tier build-minute
budget in practice. Also still open: `package-lock.json` was never
regenerated after session 19 added `whatsapp-web.js` (no network in that
session's sandbox), so `puppeteer`'s exact resolved version isn't pinned
anywhere visible — not the cause of this bug, but worth fixing whenever
`npm install` next runs somewhere with real registry access
(`npm install` locally would refresh the lockfile).

---

## 2026-09-26 (22) — Build command reverted; WhatsApp auto-send no longer logs to DB

**Scope:** Two changes, both in response to what session 21's Build
Command fix surfaced.

**1. `render.yaml`'s `npx prisma db push` step never should have run
unattended.** Turning it on (fixing the dashboard to match `render.yaml`,
per session 21) immediately hit a `prisma db push` data-loss guard on the
very next deploy — completely unrelated to WhatsApp: `users.id`,
`notifications.id` / `recipient_user_id` / `created_by`, and
`user_profile_images.user_id` are declared `Int` in `prisma/schema.prisma`
but are actually `bigint` in production Postgres. This is a pre-existing
drift (not introduced by session 19's WhatsApp work) that's been invisible
until now because `db push` had never actually run against production
before session 21's dashboard fix. Prisma correctly refused to proceed
without `--accept-data-loss` — **not applied**, and should not be, without
a dedicated investigation session with `Arp-main/database/schema.sql` in
hand: the warning explicitly says a partial failure could leave `users`,
`notifications`, or `user_profile_images` without a primary key
constraint, and `users` is the auth table every foreign key in the app
depends on. Not a risk worth taking to unblock one feature's table
creation, especially since that table (`whatsapp_sessions`) was already
created manually via direct SQL against Neon.

**Fix:** Render dashboard's Build Command reverted (by the project owner)
back to `npm install --include=dev && npm run build` — no `db push`.
Deploys are unblocked again with zero further risk to production data.
**Consequence, flagged as a new open item:** any *future* additive schema
change (new table/column) again needs to be applied manually via direct
SQL against production, same as `whatsapp_sessions` was, until the
Int/BigInt drift is investigated and resolved on purpose. `render.yaml`
still has the `db push` line in its comments/history for reference but
should not be re-enabled in the dashboard until that's done — re-check
`Arp-main/database/schema.sql` (not present in the zip used this session,
needs to be re-shared) to determine which side is actually correct before
touching `users`/`notifications`/`user_profile_images`.

**2. `whatsapp_logs` DB write removed from auto-send (owner request).**
`autoSendWhatsappMessage()` (session 19) used to write a `whatsapp_logs`
row on every Received/Ready auto-send, success or failure. Owner asked for
this to be removed — the function now just sends and returns, no DB
write at all.

**Changed:**
- `src/lib/whatsapp-auto-send.ts` — removed both `prisma.whatsappLog.create()`
  calls (the "no valid number" early-return case and the post-send case).
  Failures now only go to `console.error` (server logs), nothing in the DB
  or app UI records them.
- `render.yaml` — comment expanded with the drift/data-loss finding.

**Consequences worth knowing about, not fixed here:**
- Auto-sent Received/Ready messages will **not** appear in a device's
  WhatsApp messages history section (`devices/[id]/page.tsx` reads
  `device.whatsappLogs`) — that list now only ever shows the manual
  "Prepared" flow's entries (whatsapp-message.php port) and the
  now-removed auto-send entries won't be there for past or future sends.
  Nothing else reads `whatsapp_logs` in a way this breaks (Reports page's
  count just reports a lower number now; the backup export just exports
  fewer rows) — checked `reports/page.tsx`, `devices/[id]/page.tsx`,
  `lib/devices.ts`, `backups/generate-backup.ts`.
- A failed auto-send (disconnected WhatsApp session, bad number, send
  error) is now genuinely invisible from the app itself — only in Render's
  server console logs. If that turns out to matter in practice (e.g.
  customers report not getting messages and staff have no way to check),
  worth reconsidering some lighter-weight visibility that isn't a full
  `whatsapp_logs` row.

---

## 2026-09-26 (21) — Diagnose: `whatsapp_sessions` table missing in production

**Scope:** After session 20's build fix deployed successfully (`next build`
now passes), the WhatsApp Setup page surfaced a new, separate runtime
error: `Invalid prisma.whatsappSession.findUnique() invocation: The table
public.whatsapp_sessions does not exist in the current database.`

**Diagnosis:** session 19 added the `WhatsappSession` model to
`prisma/schema.prisma` (flagged additive-only) and also added
`npx prisma db push` to `render.yaml`'s `buildCommand`, specifically so
this table would get created on deploy (free tier has no Shell access to
run it by hand). But the failing build log from session 19/20 shows no
`prisma db push` step anywhere between `npm install` and `next build` —
strong evidence that Render's actual configured Build Command (Settings ->
Build & Deploy in the dashboard) does not match `render.yaml`, which
happens when a service is created by hand rather than via Render's
"New -> Blueprint" flow: the dashboard's own setting wins and does not
auto-sync with this file. So the `db push` step session 19 added has
likely never actually run in production.

**Not fixed by Claude — flagged to project owner, per standing instruction
never to touch production DB state without explicit confirmation:**
1. Immediate unblock: run this directly against production Postgres (Neon
   SQL Editor or any Postgres client) to create just the missing table:
   ```sql
   CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
     id         text PRIMARY KEY,
     data       bytea NOT NULL,
     updated_at timestamp NOT NULL DEFAULT now()
   );
   ```
2. Durable fix: check the Render dashboard's actual Build Command for the
   `arp-next` service and make sure it includes `npx prisma db push`
   (matching `render.yaml`), or every future additive schema change will
   have the same silent-drift problem.

**Changed:**
- `render.yaml` — added a comment at the top flagging the Blueprint-sync
  gap discovered here, so a future session doesn't waste time assuming
  this file is authoritative for what Render actually runs.
- `docs/commit-log.md` — this entry.

---

## 2026-09-26 (20) — Fix Render build failure from session 19 (unzipper/@aws-sdk/client-s3)

**Scope:** Session 19's WhatsApp auto-send feature broke the Render build:
`prisma generate` passed, but `next build` failed with `Module not found:
Can't resolve '@aws-sdk/client-s3'`, traced through
`unzipper → whatsapp-web.js RemoteAuth → src/lib/whatsapp-client.ts →
src/app/api/whatsapp/status/route.ts`.

**Diagnosis (verified, not assumed):** confirmed via `unzipper`'s own
upstream issue tracker (ZJONSSON/node-unzipper#330 — same exact error
signature) that `lib/Open/index.js` does an **unconditional top-level**
`require('@aws-sdk/client-s3')` to support an *optional* `Open.s3()` method
purely for opening zip files that live on S3. Nothing in this app calls
that method or anything on that code path — RemoteAuth only ever opens
local zip files/buffers (the whatsapp session blob, round-tripped through
Postgres, not S3). `@aws-sdk/client-s3` was correctly never installed here
(no S3 usage), but Next's webpack build statically resolves every
`require()` it finds while bundling server code, so it fails even though
the path is dead at runtime.

**Fix:** added `whatsapp-web.js` to `experimental.serverComponentsExternalPackages`
in `next.config.js`. This tells Next.js 14 to leave that package (and its
full dependency tree, including `unzipper`) out of the webpack bundle
entirely and `require()` it natively at runtime instead — so webpack never
walks into the `unzipper`/`@aws-sdk` code path in the first place. Chosen
over the alternatives: a webpack `externals`/`IgnorePlugin` entry would
work too but is more fragile (has to be kept in sync manually); actually
installing `@aws-sdk/client-s3` as a real dependency would "fix" the build
but adds real weight (an unused AWS SDK package) for a code path that's
never exercised — not worth it just to satisfy webpack's static analysis.
Renamed to the stable top-level `serverExternalPackages` config key in
Next.js 15 — flagged in a comment in `next.config.js` for whenever this
project upgrades past 14.

**Verified:** confirmed the root cause against `unzipper`'s own GitHub
issue tracker (exact matching error signature) rather than guessing; this
sandbox still has no network access (same standing constraint as deviation
#4 in `status.md`), so the fix could not be confirmed against an actual
`npm install && next build` run or a real Render deploy. Push and watch
the next Render build log to confirm this clears the `next build` step
before trusting it fully.

**Changed:**
- `next.config.js` — added `whatsapp-web.js` to
  `experimental.serverComponentsExternalPackages`, with an inline comment
  explaining why (see above).

---

## 2026-09-26 (19) — Automatic WhatsApp sending (Received/Ready)

**Scope:** The WhatsApp messages section on a device's detail page used to be
100% manual (button → wa.me link → staff taps Send in WhatsApp). Owner
wanted Received/Ready messages sent with no button click, and free only.

**Decision (owner-confirmed):** Meta's Cloud API is not free for
business-initiated messages under its current per-message pricing, and
needs template approval + a dedicated Business number regardless. The only
free path is `whatsapp-web.js` (unofficial — automates a real WhatsApp
account via headless Chrome). Owner explicitly accepted the ToS/ban-risk
tradeoff and asked to pair a second number (+251941135836) for this, not
the number used for existing manual messages. Also explicitly declined
message-randomization/evasion tricks aimed at avoiding detection — none
were built; the only mitigations are low volume and keeping the manual
wa.me flow intact as a fallback.

**Changed:**
- `prisma/schema.prisma` — **flagged schema change**: added `WhatsappSession`
  (`whatsapp_sessions` table), additive only, no existing table/column/CHECK
  constraint touched. Single-row blob store for the paired WhatsApp session.
- `src/lib/whatsapp-client.ts` (new) — whatsapp-web.js `Client` singleton
  (kept on `globalThis`). Uses `RemoteAuth` with a custom Prisma-backed
  store (`PrismaWhatsappStore`) instead of the default `LocalAuth`, because
  Render's free-tier filesystem is ephemeral (same constraint already
  documented in `system-backups/page.tsx`) — a local session folder would
  be wiped on every deploy/restart. Exposes `getWhatsappStatus()` (for the
  pairing page) and `sendWhatsappTextMessage()`.
- `src/lib/whatsapp-auto-send.ts` (new) — `autoSendWhatsappMessage()`:
  looks up the job, builds the message with the existing
  `buildDefaultWhatsappMessage()` template logic, sends it, and always logs
  to `whatsapp_logs` (`messageStatus`: `"Sent"` or `"Failed"`) — including
  when the customer has no valid WhatsApp number on file. Never throws.
- `src/app/api/devices/register/route.ts` — fires (`void`, non-blocking)
  `autoSendWhatsappMessage({ messageType: "Received" })` after a device is
  registered.
- `src/app/api/repairs/[id]/route.ts` — fires the same for `"Ready"`, only
  when status just changed *to* Ready (not on every edit while already
  Ready); transaction result now also returns `statusChanged`/`newStatus`.
- `src/app/api/whatsapp/status/route.ts` (new), `src/app/(app)/settings/whatsapp/page.tsx`
  (new), `src/components/settings/WhatsappStatusPanel.tsx` (new) — Admin-only
  pairing page: shows a live QR code (polls every 4s) to link the phone,
  then shows connected/error state. This is the one-time (or re-pairing)
  setup step; no credentials or .env changes needed since everything is
  stored in the existing Postgres DB.
- `src/lib/nav.ts` — added "WhatsApp Setup" under Administration (Admin only).
- `package.json` — added `whatsapp-web.js`, `qrcode` (+ `@types/qrcode`).

**Known operational risks (flagged to owner, not silently absorbed):**
- Unofficial automation — real risk of the paired number getting banned by
  WhatsApp; if it happens, the existing manual wa.me flow on the *other*
  number is unaffected.
- Headless Chrome is heavy for Render's free-tier RAM/CPU; if the process
  gets OOM-killed or restarted, the QR pairing page may need a rescan even
  with the DB-backed session (RemoteAuth's periodic backup means anything
  since the last 5-minute sync could be lost) — worth watching in practice,
  not something that can be fully verified without a real deploy.
- `npm install` will now also download Puppeteer's bundled Chromium
  (~300MB), so first build after this change will take noticeably longer.

**Not done / still manual:** the "Delivered" message (button-triggered
prepare flow, untouched) — owner only asked for Received and Ready to
auto-send.


## 2026-09-26 (18) — Export PDF, System Backups, Local/Intra guide split

**Scope:** Closed out the two remaining "In progress / not started" items
(Export PDF, System backups UI) plus the Local/Intra guide split and its
regional-office field. All original PHP pages are now ported.

**Changed:**
- `src/lib/reports/generate-report-pdf.ts`, `src/app/api/reports/export-pdf/route.ts`
  — real server-generated PDF (pdfkit) for the Reports page, replacing the
  original's browser-print approach. Admin only. Button added to
  `src/app/(app)/reports/page.tsx`.
- `src/lib/backups/generate-backup.ts`, `src/app/api/system/backup/route.ts`,
  `src/app/(app)/system-backups/page.tsx` — on-demand DB backup: dumps every
  table as SQL inserts + a manifest, zipped in memory (jszip), streamed
  straight to the browser. **Deliberately does not write to local disk**
  like the original `backup-engine.php` did — Render's free-tier filesystem
  is ephemeral with no persistent disk, so anything saved there would be
  lost on the next deploy/restart. No backup history list as a result
  (decision: acceptable since Neon runs its own independent automated
  backups/PITR — this is a convenience export, not the only safeguard).
  Logs an `backup_created` audit entry per download.
- `src/lib/nav.ts` — Guide now points Local → `/guide/local`, Intra →
  `/guide/intra` instead of one shared `/guide` route (Register/Manage
  stay identical between the two groups, unchanged).
- `src/app/(app)/guide/local/page.tsx`, `src/app/(app)/guide/intra/page.tsx`
  — new placeholder pages (still "content coming later" — project owner
  will supply the actual guide content in a future session before this is
  built out for real). Old `src/app/(app)/guide/page.tsx` now just
  redirects to `/guide/local` so no old link 404s.
- `src/components/devices/RegisterDeviceForm.tsx`,
  `src/app/api/devices/register/route.ts` — added one optional field,
  Regional Office / location, wired to the existing (previously unused)
  `Customer.regionalOffice` column. This is the one Intra-specific addition
  to the still-shared Register Device form — no separate Intra form.

**Verified:** not run against a live DB/browser this session (chat-only
delivery, see CLAUDE.md workflow) — click through Export PDF, Download
Backup, and a registration with Regional Office filled in on a real
deployment before trusting end to end.

**Decisions made, not yet fully closed:**
- Guide content itself is still empty for both Local and Intra — waiting on
  the project owner to bring the actual content in a later session.

---

## 2026-09-26 (17) — WhatsApp message prep

**Scope:** Second of the three not-started items (Receipts done last
session). Ported the WhatsApp message-prep screen and its logging endpoint.

**Changed:**
- `src/lib/whatsapp.ts` — new shared helpers ported from
  `app/pages/receipts/whatsapp-message.php`: Ethiopia-oriented phone
  normalization (`normalizePhoneForWhatsapp`), the three message templates
  (`buildDefaultWhatsappMessage`), accessory-list text builders, the
  workflow-availability check (`getWhatsappWorkflowError` — Ready needs
  status Ready/Delivered, Delivered needs status Delivered), and the
  credential-leak content guard (`WHATSAPP_FORBIDDEN_CONTENT`). Split out
  as shared helpers because the page (initial render) and the API route
  (server-side re-validation on submit) both need identical logic — the
  original computed both in one PHP request.
- `src/app/(app)/devices/[id]/whatsapp/page.tsx` — new page,
  `?type=Received|Ready|Delivered`. Lives inside the `(app)` route group
  (shared sidebar) since the original includes `includes/sidebar.php` here
  — unlike the receipt preview page, this one is a normal in-app screen.
  Role gate: Admin, Reception, Technician (Secondary Admin redirected to
  `/dashboard`). Deliberately **not** scoped to a Technician's own assigned
  jobs — the original's SQL has no such clause for this feature (unlike
  receipts) — see status.md deviation #14.
- `src/components/devices/WhatsappMessageForm.tsx` — new client component:
  editable message textarea with a live preview panel (mirrors the
  original's `oninput` handler), submits to the API route, then navigates
  the browser to the returned `wa.me` URL (replacing the original's
  server-side `header('Location: ...')` redirect).
- `src/app/api/devices/[id]/whatsapp/route.ts` — new API route, ported from
  the POST branch of `whatsapp-message.php`. Re-validates message type,
  workflow state, phone number, length (10–2000 chars), and the
  credential-leak regex server-side; inserts into `whatsapp_logs`
  (`message_status: "Prepared"`), writes an audit log
  (`action_type: "whatsapp_message_prepared"`, failure here doesn't fail
  the request, matching the original's own try/catch), and returns the
  `wa.me` URL. No CSRF token (established codebase decision, status.md
  deviation #3).
- `src/app/(app)/devices/[id]/page.tsx` — added a "Prepare {status} Message"
  button next to the WhatsApp messages panel, shown when status is
  Received/Ready/Delivered — matches the original's action-bar condition.
  Rendered for all four roles the device page is visible to (including
  Secondary Admin), same as the original; see deviation #14 for why that's
  a knowingly carried-over gap, not new.

**Verified:**
- `npx tsc --noEmit` — clean
- `npm run build` — compiles and typechecks fully; fails only at
  "Collecting page data" on the same pre-existing sandbox limitation as
  every prior session (no network access to fetch the Prisma query-engine
  binary — status.md deviation #4). Not a regression.

**Not verified:** not run against a live DB/browser — please click through
Prepare Message → Save & Open WhatsApp on a real job in each of the three
message types before trusting the phone-normalization and template output
end to end (Ethiopian numbers especially — the 09xxxxxxxx / 07xxxxxxxx /
+2519xxxxxxxx / 2519xxxxxxxx variants).

**Deviations — see status.md deviation #14 for the full writeup:**
- Secondary Admin sees the "Prepare Message" button (device page allows
  that role) but is denied by the page/endpoint (this feature doesn't) —
  carried over exactly from the original, not fixed.
- No per-Technician job scoping on this feature, unlike Receipts — also
  carried over exactly, not an oversight.

---

## 2026-09-26 (16) — Receipts: preview page + printed tracking

**Scope:** First of the three not-started items to be picked up (Receipts,
WhatsApp message prep, Reports). Ported the receipt preview screen and its
print-tracking endpoint; PDF export was re-scoped to the Reports item (see
below).

**Changed:**
- `src/app/receipts/[id]/page.tsx` — new standalone receipt preview page,
  ported from `app/pages/receipts/receipt-preview.php`. Deliberately placed
  outside the `(app)` route group (no sidebar), matching the original's
  standalone/printable page. Role gate: Admin, Reception, Technician only
  (Secondary Admin gets a plain redirect to `/dashboard` — the original
  never linked this page for that role, so unlike deviation #10 there's no
  partial-visibility inconsistency to preserve here). A Technician is
  further scoped to receipts belonging to jobs assigned to them
  (`assignedTechnicianId`), matching the original's conditional SQL.
- `src/components/receipts/PrintReceiptButton.tsx` — new client component,
  ported from the inline `<script>` on `receipt-preview.php`. POSTs to the
  print-tracking endpoint first, then calls `window.print()`, and updates
  its own label with the returned print count — same sequencing as the
  original.
- `src/app/api/receipts/[id]/print/route.ts` — new API route, ported from
  `app/pages/receipts/mark-receipt-printed.php`. Same role gate and
  Technician scoping as the preview page; increments `print_count` +
  stamps `printed_at` in a transaction, then writes an `audit_logs` row
  (`action_type: "receipt_printed"`) — an audit-log failure does not fail
  the request, matching the original's own try/catch around that part.
  No CSRF token (same established decision as every other mutating route
  in this codebase — see status.md deviation #3).
- `src/app/(app)/devices/[id]/page.tsx` — the existing Receipts list now
  shows the print count when > 0, and links each receipt to its new
  `/receipts/[id]` preview page (link only shown for the three roles that
  can actually open it).

**Verified:**
- `npx tsc --noEmit` — clean
- `npm run build` — compiles and typechecks successfully; fails only at
  "Collecting page data" on the pre-existing, already-documented sandbox
  limitation (no network access to `binaries.prisma.sh` to fetch the Prisma
  query-engine binary — see status.md deviation #4). Same failure point as
  every prior session's build attempt in this sandbox; not a regression.

**Not verified:** not run against a live DB/browser (same sandbox network
limitation as always) — please click through Preview → Print on a real
repair job's receipt before trusting the visual layout and the print
dialog behavior.

**Deviations — see status.md deviation #13 for the full writeup:**
- The receipt preview's visual design is a Tailwind rebuild, not a
  pixel-for-pixel port of `assets/css/receipt.css`. Same data, same
  sections, same print behavior — different exact styling.
- "PDF export" was dropped from the Receipts item in status.md's
  "In progress" list — `export-report-pdf.php` is actually part of the
  **Reports** page (`requireRoles(['Admin'])`, a full system report), not a
  per-receipt PDF. There is no receipt-to-PDF endpoint in the original at
  all; receipts are only ever printed via the browser dialog. Moved that
  line item to Reports accordingly so it isn't lost, and isn't double-
  counted as "still needed" here.

---

## 2026-09-25 (15) — Render build fix: missing `baseUrl` broke `@/*` alias resolution in production

**Scope:** Render deploy kept failing with `Module not found: Can't resolve
'@/lib/auth'` (and `@/lib/prisma`, `@/lib/devices`,
`@/components/devices/EditDeviceForm`) on `src/app/(app)/dashboard/page.tsx`
and `src/app/(app)/devices/[id]/edit/page.tsx`, every attempt, across a
brand-new Render service, a pinned Node version (20.18.0, ruling out the
auto-selected 26.10.0), and a confirmed-clean checkout (`ls -la src/lib`
run as part of the build command showed all files present with correct
byte sizes seconds before `next build` ran). Not reproducible locally —
the exact same commit built cleanly elsewhere.

**Root cause:** `tsconfig.json` had `"paths": { "@/*": ["./src/*"] }` but
no `"baseUrl"`. TypeScript's own type-checker has supported `paths`
without `baseUrl` since TS 4.1 (why `npx tsc --noEmit` was clean, see
deviation #7), but Next.js's webpack alias plugin has long-standing,
version- and timing-sensitive inconsistent behavior resolving `paths`
without an explicit `baseUrl` — this matches the observed pattern exactly:
passed on a fast unconstrained machine, failed deterministically and
near-instantly on Render's constrained free-tier build, always the first
1-2 entry points webpack touched.

**Changed:**
- `tsconfig.json` — added `"baseUrl": "."` to `compilerOptions`, matching
  Next.js's own documented pattern for `@/*` aliases. No other change.

**Not verified:** not yet re-deployed to Render to confirm the fix lands —
project owner is pushing this next.

---


## 2026-09-25 (14) — Render deployment prep: health check + self-ping + fixed a build-blocking bug

**Scope:** Get the app deployable on Render, matching the original app's
actual host (see deviation #11 below — not Railway, despite `CLAUDE.md`
and `railway.json` saying so). Read `Arp-main/Dockerfile`,
`docker-entrypoint.sh`, `health.php`, and `railway.json` in full first.

**Changed:**
- `src/app/api/health/route.ts` — new route, ported from `health.php`:
  plain `200 ok`, `text/plain`, `Cache-Control: no-store`, no DB work.
- `src/instrumentation.ts` — new file, ported from `docker-entrypoint.sh`'s
  `APP_BASE_URL` background loop: self-pings `/api/health` every 10
  minutes (same interval as the original's `sleep 600`) so Render's free
  tier doesn't spin the service down after 15 minutes idle. Uses Next.js's
  `register()` instrumentation hook instead of a shell background job;
  guarded to the Node runtime only (`register()` also fires in the Edge
  runtime, which the original's shell-loop approach has no equivalent
  concern for). Defaults to Render's auto-set `RENDER_EXTERNAL_URL`; an
  `APP_BASE_URL` env var overrides it (custom domain, non-Render host, or
  local testing). No-ops with neither set, e.g. local dev.
- `next.config.js` — **replaces `next.config.ts`**, see deviation #12: the
  `.ts` variant isn't valid until Next.js 15 and was silently failing
  `next build` since the original scaffold. New file also adds
  `experimental.instrumentationHook = true`, required on 14.x for
  `src/instrumentation.ts` to run at all (stable without the flag from 15
  on).
- `render.yaml` — new Render Blueprint: native Node runtime (`env: node`),
  not Docker — this app only needs `npm install && npm run build` /
  `npm start`, so there's nothing for a Dockerfile to add here, unlike the
  original PHP app's Docker-based setup (which exists to run PHP migration
  scripts and a custom built-in-server invocation). `healthCheckPath:
  /api/health`. Secrets (`DATABASE_URL`, `AUTH_SECRET`, `CREDENTIAL_KEY`,
  `CRON_SECRET`) are `sync: false` — set by hand in the Render dashboard,
  never committed.
- `package.json` — added `postinstall: prisma generate` (Render runs
  `npm install` before the build command; without a `postinstall` hook the
  Prisma client would never get generated on a fresh deploy) and an
  `engines.node` floor (`>=18.18.0`).
- `.env.example` — documented `APP_BASE_URL` as the self-ping override.
- `CLAUDE.md` — corrected the deployment-target note (Railway → Render,
  see deviation #11) and pointed at this session for the deploy steps.

**Verified, in this sandbox:**
- `npx tsc --noEmit` — clean (real `node_modules`, `npm install` reached
  the npm registry fine this session).
- `npx next build` — compiles and typechecks successfully, gets all the
  way to "Collecting page data" before failing **solely** on the
  pre-existing, already-documented inability to fetch Prisma's engine
  binary from this sandbox (deviation #4, unrelated to this session's
  changes — confirmed by also trying
  `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1`, which didn't help either;
  `binaries.prisma.sh` isn't reachable here at all). **Run `npm run
  build` in a real environment (or let Render's own build run it) to
  confirm it completes end-to-end.**

**Not verified:** not deployed to an actual Render service — no live
sanity check that the self-ping loop round-trips or that the free tier
actually stays warm. Deploy steps are in the reply, not repeated here.

**Known deviations, called out explicitly:**
- **Deployment target corrected: Render, not Railway** — see
  `docs/status.md` deviation #11. `CLAUDE.md` and this file's own session
  1 and session 12 entries said Railway; `Arp-main/docker-entrypoint.sh`
  and `Arp-main/health.php` say otherwise in their own comments. Flagging
  loudly in case that reading is wrong.
- **Found and fixed a pre-existing, build-blocking bug unrelated to this
  session's actual task** — see `docs/status.md` deviation #12.
  `next.config.ts` has been invalid on this app's Next.js 14 since the
  original scaffold; nothing caught it because `next build` had never
  actually been run before (every prior session's sandbox lacked the
  network access to get that far).
- `render.yaml`'s `region: oregon` and `branch: main` are placeholders —
  confirm the real Postgres region and default branch name before
  deploying (see reply for the `git branch --show-current` check already
  called out in `CLAUDE.md`'s delivery workflow).

---

## 2026-09-25 (13) — Devices: manufacturer lookup + reveal Outlook password

**Scope:** Ported the two remaining Devices sub-features flagged since
session 4: `manufacturer-info.php` (+ `includes/device-manufacturer.php`)
and `reveal-outlook-password.php`. Both read in full before porting.

**Changed:**
- `src/lib/device-manufacturer.ts` — `manufacturerLookup()`, ported from
  `includes/device-manufacturer.php`: splits a composite identifier label
  on `,`/`;`/`|` into serial/product-number/warranty-code, detects HP by
  serial prefix or product-number pattern, builds a manufacturer support
  URL (HP's own identify page, or a Google search of serial + product
  number for anything else). Pure function, same logic and regexes as the
  original translated to JS equivalents.
- `src/app/(app)/devices/[id]/manufacturer/page.tsx` — new page, ported
  from `manufacturer-info.php`: identifiers panel (serial, product number,
  warranty label, AUC asset barcode) + official support actions (identify
  product / check warranty / find parts), with the HP-specific official
  URLs substituted in exactly as the original does. **Simplified UI**: uses
  this app's existing card/Tailwind design system instead of the original's
  bespoke gradient-hero CSS, and drops the copy-to-clipboard buttons (same
  info, less UI to maintain — same precedent as other ported pages'
  "simplification, no functional loss" deviations).
- `src/app/api/devices/[id]/reveal-outlook-password/route.ts` — new `POST`
  route, ported from `reveal-outlook-password.php`: role-gated (Admin,
  Reception, Technician — Secondary Admin NOT included, see deviation
  below), decrypts `customers.outlook_password_encrypted` via the already-
  ported `decryptCredential()` (`src/lib/credentials.ts`, in place since
  session 3 but never actually called until now), writes an audit log
  (`action_type: 'credential_viewed'`, `record_type: 'repair_job'`,
  `action_details: { credential: 'outlook_password' }`) whose failure is
  caught separately so it can't block returning the password — matches the
  original's nested try/catch exactly. No CSRF token: the original
  protected this one endpoint with a session CSRF token, but this port
  follows the CSRF-drop decision already made for the whole codebase
  (`docs/status.md` deviation #3) rather than reintroducing it for a single
  route.
- `src/components/devices/RevealOutlookPasswordButton.tsx` — new client
  component, ported from the `.credential-reveal` handler in
  `assets/js/app.js`: "Show" always re-fetches (and re-audit-logs) the
  password; "Hide" is a pure client-side toggle back to bullets, no
  re-fetch; a failed reveal shows the error message in place of the
  password and leaves the button retryable. Same behavior, React instead
  of vanilla JS DOM manipulation.
- `src/app/(app)/devices/[id]/page.tsx` — wired both features in: an
  "Outlook password" row (Customer panel) using the new reveal button, and
  a "Manufacturer" row (Device panel) showing manufacturer + product number
  with a "Find more" link to the new `/devices/[id]/manufacturer` page —
  same placement as the original's view-device.php.

**Verified:** `npx tsc --noEmit` — clean, against a real installed
`node_modules` (see session 12's note — `npm install` worked in this
sandbox this time). Same stub-`.prisma/client`-types caveat as session 12
still applies (`prisma generate` still can't reach its binaries here), but
none of this session's Prisma usage needed the stopgap `any` typing that
session 12's did.

**Not verified:** not run against a live DB or a browser — in particular,
the HP-detection regexes and the composite-identifier splitting are
unverified against real scanned-label data, and the reveal endpoint's
decrypt path is unverified against a real `CREDENTIAL_KEY` /
`outlook_password_encrypted` value.

**Known deviations, called out explicitly:**
- **Role-visibility inconsistency carried over as-is, not fixed.** The
  "Show" button is visible to Secondary Admin (page-level role gate is all
  four roles), but the reveal endpoint denies Secondary Admin (matches the
  original's own `requireRoles(['Admin','Reception','Technician'])` on
  `reveal-outlook-password.php` exactly). Per CLAUDE.md, a role-visibility
  rule is never silently dropped when porting — so this port keeps the
  exact original behavior, inconsistency included, rather than guessing
  which side to "fix." See `docs/status.md` deviation #10.
- No CSRF token on the reveal endpoint (see above) — consistent with, not
  a new instance of, deviation #3.
- Copy-to-clipboard buttons on the manufacturer page were dropped —
  cosmetic simplification only, not a data/behavior change.

---

## 2026-09-25 (12) — Repair-deadline background sync

**Scope:** Ported `syncRepairDeadlines()` from
`includes/repair-deadlines.php` (read in full before porting anything, per
instructions). Nothing in the new stack generated "repair overdue"
notifications before this session.

**Architecture decision — scheduled API route, not tied to page loads:**
The original ran this synchronously inside `includes/auth.php` on every
authenticated page load. This port instead exposes it as a standalone,
secret-protected endpoint (`GET`/`POST /api/cron/sync-repair-deadlines`)
meant to be triggered on a schedule. Reasoning, in short:
- `CLAUDE.md` already flags that this app's Docker/Railway deployment
  config doesn't exist yet. Railway's native Cron Job feature is a
  separate service that would need that config to model itself on —
  nothing to attach it to yet, so reaching for it now means building on a
  foundation that isn't there.
- An HTTP endpoint has zero deployment dependencies. It works today and
  will slot into whatever scheduler eventually gets set up (a Railway Cron
  Job hitting this URL with curl, a scheduled GitHub Actions workflow,
  cron-job.org, anything) without the route itself changing.
- Mirroring the original exactly (call it on every page load) was
  considered and rejected: it would add a notifications-table read/write
  to every authenticated request indefinitely, for a check that only needs
  to run occasionally — and it still wouldn't fire on days nobody logs in,
  which is exactly when an unattended overdue job is most likely to go
  unnoticed.

**This is a real, load-bearing caveat, not a formality: the endpoint does
nothing until a scheduler is pointed at it.** That's an infra step outside
this codebase — set `CRON_SECRET` in the deployment environment, then
configure a scheduler to hit
`GET https://<deployment>/api/cron/sync-repair-deadlines` with
`Authorization: Bearer <CRON_SECRET>` (or `?secret=<CRON_SECRET>` as a
fallback for schedulers that can't set custom headers), on some recurring
cadence — daily is almost certainly enough, since deadlines are dates, not
times.

**Changed:**
- `src/lib/repair-deadlines.ts` — added `syncRepairDeadlines()` next to the
  existing `validExpectedCompletionDate()`. Same recipient set as the
  original's `CROSS JOIN LATERAL ... UNION` (job's assigned technician +
  assigned secondary admin + every active Admin), same dedup intent (one
  notification per recipient per job, via a pre-fetch of existing
  `repair_overdue` notifications for the overdue job IDs rather than the
  original's single atomic `INSERT ... SELECT ... WHERE NOT EXISTS` — see
  deviations below), same message text (`"<job_id> was expected by <DD Mon
  YYYY> and is still <status>."`), same `notification_type` value
  (`repair_overdue`) and `created_by: NULL`. Does **not** write an
  audit_log entry, matching the original (this function only ever touches
  `notifications`) — so this doesn't touch the `audit_logs.action_type`
  naming question from deviation #8.
- `prisma/schema.prisma` — added `@@index([expectedCompletionDate])` to
  `RepairJob`, matching the original's partial index
  (`idx_repair_jobs_expected_completion`). The original's schema-guard
  (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) was **not** ported —
  `expected_completion_date` is already a real Prisma-managed column here,
  that guard only existed for pre-deadline-feature deployments of the old
  app.
- `src/app/api/cron/sync-repair-deadlines/route.ts` — new route, `GET` and
  `POST` both do the same thing (some schedulers only offer one or the
  other). Checks `CRON_SECRET` via `Authorization: Bearer` or `?secret=`
  before calling `syncRepairDeadlines()`. On failure, returns a 500 with
  the error — a deliberate deviation from the original (which catches and
  only `error_log()`s, never failing the page load it rode along on); since
  this route *is* the whole operation now, a failure should be visible to
  whatever's calling it on a schedule.
- `src/middleware.ts` — added `/api/cron/sync-repair-deadlines` to
  `PUBLIC_PATHS`. There's no logged-in user for a scheduled trigger, so it
  can't go through the session-cookie check like other routes; it guards
  itself with `CRON_SECRET` instead.
- `.env.example` — added `CRON_SECRET` with a short explanation.
- `docs/status.md` — moved repair-deadline sync from "not started" to
  "done, but needs a scheduler wired up" (new deviation #9); updated the
  "To resume" candidate list accordingly.

**Verified:** `npx tsc --noEmit` — clean. Unlike every prior session, `npm
install` actually succeeded in this sandbox this time (registry reachable),
so this was checked against a real `node_modules`/TypeScript, not just
reviewed by eye. **However**, `npx prisma generate` / `npx prisma validate`
still failed the same way as every prior session (`binaries.prisma.sh`
unreachable — `schema-engine.gz.sha256 - 403 Forbidden`), so `tsc` ran
against the same stub `.prisma/client` types as before, not a real
generated client for this schema. Two implicit-`any` errors from that stub
(on `.map()` callbacks over Prisma query results) were fixed with the same
explicit-inline-type stopgap already used elsewhere in this codebase (e.g.
`src/app/api/repairs/[id]/route.ts`'s `admins.map((a: { id: number }) =>
...)`). **Run `npx prisma generate` and `npx tsc --noEmit` again in a real
environment before trusting this fully compiles against the real client**,
and revisit those stopgap types once it does (same standing note as every
earlier session's `any`-typing caveat).

**Not verified:** not run against a live DB, endpoint not actually hit
end-to-end (no Postgres available here), and — see above — no scheduler is
configured anywhere yet, so even once deployed this generates zero
notifications until that's set up.

**Known deviations, called out explicitly:**
- **No scheduler wired up yet** — the load-bearing caveat above, repeated
  here because it's the main thing to act on: this feature is inert until
  an external cron trigger is configured.
- **Dedup is no longer a single atomic SQL statement.** The original's
  `INSERT ... SELECT ... WHERE NOT EXISTS` guarantees no duplicate
  (recipient, job) notification even under concurrent triggers. This port
  reads existing notifications, then writes — two overlapping calls to the
  endpoint (e.g. someone manually re-triggering it while the scheduled run
  is still in flight) could theoretically both pass the "not already
  there" check and create a duplicate. Not expected to matter given the
  intended daily-ish cadence, and a duplicate overdue notification is
  cosmetic, not data-corrupting — but flagged rather than silently assumed
  safe. No unique constraint was added to `notifications` to close this
  gap: doing so blind, without knowing whether the live table already has
  colliding rows (the original has run in production without one), risks a
  migration that fails outright — that's a call for the project owner, not
  something to guess at here.
- **Message/date formatting reimplemented, not reused.** The original
  builds the message string in SQL (`TO_CHAR(..., 'DD Mon YYYY')` and
  string concatenation); this port does it in TypeScript
  (`formatOverdueDate()`). Same output format, different mechanism —
  flagging since a formatting bug here wouldn't be caught by comparing
  against the original's SQL directly.

---

## 2026-09-25 (11) — Real dashboard

**Scope:** Replaced the `/dashboard` placeholder with a real one. Ported
from `app/pages/reports/dashboard.php`: greeting header, repair-status
strip, repair-flow lifecycle view, most-recent-activity panel, and an
"Operations Pulse" summary. `reports.php` was read too, but the dashboard
doesn't call into it — the original's dashboard stats are self-contained
in `dashboard.php`'s own queries.

**Changed:**
- `src/app/(app)/dashboard/page.tsx` — full rewrite (was a placeholder).
  Server component: status counts via `prisma.repairJob.count()` per
  status (five parallel counts, same shape as the original's
  `COUNT(*) FILTER (WHERE status = ...)`), most recent `audit_logs` row
  (`ORDER BY performed_at DESC, id DESC LIMIT 1`, matching the original's
  `LIMIT 1` exactly) with a resolved device link and actor name, time-of-
  day greeting, and a repair-flow strip linking into `/devices?status=X`
  (matches `manage-devices.php`'s existing query-param handling).
- `docs/status.md` — moved dashboard to Done; recorded three deviations
  (below); also cleaned up two stale duplicate entries in "In progress"
  (Repairs and Users were both re-listed as if not started, even though
  session 6/8 already shipped them — only their genuinely-still-open
  sub-items, already tracked as their own bullets, remain).

**Verified:** Not run through `tsc` — no `node_modules`/network in this
sandbox (`npm install` returns a registry 403, same as every session so
far). Written to match already-verified patterns in this codebase
(`prisma.repairJob.count()` / `findUnique` shapes already used in
`src/lib/devices.ts` and the devices API routes). Deliberately avoided
`prisma.repairJob.groupBy()` for the status counts — functionally
equivalent, but `groupBy`'s generic typing is more sensitive to having a
real generated Prisma Client on hand to check against, which isn't
possible here. **Run `npx tsc --noEmit` locally before trusting this
compiles.**

**Not verified:** not run against a live DB, not seen in a browser — in
particular the `audit_logs` join (resolving a `repair_job` record from
`record_id`) and the status counts are unverified against real data.

**Known deviations, called out explicitly:**
- **Notification bell/popover NOT ported.** The original's dashboard
  header has an admin-only bell with a live unread-notification popover
  (auto-pops on a new notification, tracked via a session flag). This
  ties directly into the Notifications feature, which the project owner
  already deprioritized (2026-09-25, see `docs/status.md`) — building the
  popover here would mean building notification-fetching logic for a
  feature that isn't a current priority. The sidebar's existing unread
  badge (`src/app/(app)/layout.tsx`, already querying
  `prisma.notification.count()`) is untouched and still works.
- **Recent activity shows exactly one item**, matching the original's
  `LIMIT 1` literally. This reads like it might have been an oversight in
  the original rather than an intentional design choice — a "recent
  activity" panel with room for a short list would show more than one
  row. Kept faithful to the source rather than guessing; easy to bump to
  `LIMIT 5` (or similar) if the project owner confirms that's what they
  actually want.
- **"Register Device" quick-action button is hidden for Secondary
  Admin.** The original shows this button to every role unconditionally.
  But `/devices/register` (session 3) already redirects Secondary Admin
  straight back to `/dashboard` — same restriction the sidebar nav
  already encodes (`src/lib/nav.ts`: "Register Device: Admin, Reception,
  Technician (NOT Secondary Admin)"). Showing the button to a role that
  can't use the destination is a dead-end click, not a real permission
  the original intended to grant, so this port hides it. Flag if the
  project owner disagrees and wants literal parity instead.
- **Discovered, not introduced, by this session:** `audit_logs.action_type`
  values written elsewhere in this codebase have already drifted from the
  original PHP app's naming (`CREATE`/`UPDATE`/`STATUS_CHANGE`/etc. vs.
  this rewrite's `device_edited`/`repair_updated`/`technician_assigned`/
  etc.) — see `docs/status.md` deviation #8 for the full list. The
  dashboard's activity-label map is keyed to the values actually written,
  with a title-cased fallback for anything unmapped (same fallback
  behavior as the original), so nothing is broken by this — but it's
  worth a deliberate decision before the Audit History page is built, so
  that page isn't the one that has to first discover and paper over the
  inconsistency.

---

## 2026-09-25 (10) — Forgot / reset password flow

**Scope:** Migrated `forgot-password.php`, `forgot-password-sent.php`, and
`reset-password.php`. `/login`'s "Forgot your password?" link now goes
somewhere real instead of a dead route.

**Changed:**
- `src/lib/password-reset.ts` — `checkResetToken()`: shared read-only token
  validation (well-formed 64-hex-char check, exists, not used, not
  expired), ported from the inline checks at the top of
  `reset-password.php`. Used by both the GET (validate) and POST (submit)
  handlers below so the two can't drift out of sync.
- `src/app/api/auth/forgot-password/route.ts` — `POST`: case-insensitive
  username lookup (excludes soft-deleted users, matching the login route's
  `deletedAt: null` filter), expires any outstanding tokens for that user,
  generates a new 64-hex-char token good for 1 hour. **Always returns 200**
  regardless of whether the account exists, so response status can't be
  used to enumerate usernames — matches the original's "always redirect to
  the same success page" behavior. Only the response body differs
  (`found: true` + the link, vs. `found: false`).
- `src/app/api/auth/reset-password/route.ts` — `GET`: validates a token
  without changing anything, for the reset page to check on load. `POST`:
  validates again, checks the new password (reuses
  `isValidNewPassword()` from `src/lib/user-validation.ts`) and
  confirmation match, then in one transaction: hashes the password via
  `hashPassword()` (bcrypt cost 12, same as `src/lib/auth.ts` already
  uses), updates the user, marks the token used, and writes an audit log
  entry (`performed_by: NULL`, `action_type: 'password_reset'`, reason
  `"Self-service password reset via token"`, IP from `x-forwarded-for`) —
  matches `reset-password.php`'s `audit_logs` insert exactly.
- `src/app/forgot-password/page.tsx` — form + result, **consolidated into
  one page** (see deviation below).
- `src/app/reset-password/page.tsx` — validates the token on load (loading
  → invalid/expired state, or the set-new-password form), password
  show/hide toggle, lightweight strength label (text only, no animated
  bar). Wrapped in `<Suspense>` because it reads the token via
  `useSearchParams()`.
- `src/middleware.ts` — added `/reset-password`,
  `/api/auth/forgot-password`, and `/api/auth/reset-password` to
  `PUBLIC_PATHS` (`/forgot-password` and `/api/auth/login` were already
  there). Without this, an unauthenticated user hitting a reset link would
  get bounced to `/login` before ever seeing the reset form.

**Verified:** Not run through `tsc` — no `node_modules`/network in this
sandbox (same limitation as every session so far; `npm install` fails
here with a registry 403). Written to match already-established patterns
in this codebase (transaction shape from
`api/users/[id]/reset-password/route.ts`, IP extraction from
`api/auth/login/route.ts`) rather than anything new. **Run
`npx tsc --noEmit` locally before trusting this compiles.**

**Not verified:** not run against a live DB, not seen in a browser, no
Postgres available here to confirm the `password_reset_tokens` round-trip.

**Known deviations, called out explicitly:**
- **Two original pages merged into one, per side of the flow.** The
  original has `forgot-password.php` (form) redirect to a separate
  `forgot-password-sent.php` (result), passing the generated link through
  PHP session state. This port keeps the form and the result on the same
  page (`/forgot-password`) using client-side React state instead of a
  redirect — there's no server session to stash the link in between
  requests here, and putting the raw reset token in a query string just to
  redirect would leave it sitting in browser history, which is worse than
  the original's session-based approach. No behavior is lost: same
  messaging, same "no account found or inactive" wording, same copy-link
  button. Same simplification precedent as session 6's inline
  reset-password modal for admins.
- **No email delivery — intentional, not a gap.** Confirmed via the
  original source: this is genuinely a no-email internal system already;
  the PHP version hands the generated link straight back to whoever
  submitted the form ("admin shares the link"). This port does the same.
  If real email delivery is ever wanted, that's a new feature request, not
  something this migration dropped.
- Password strength meter is a plain text label ("Too weak" → "Very
  strong"), not the original's animated colored bar — same scoring logic,
  lighter UI. Cosmetic only.
- No CSRF token on either new form — consistent with the CSRF-drop
  decision already flagged as deviation #3 in `docs/status.md` for the
  login flow; not a new decision made here.

---

## 2026-09-25 (9) — Terminology fix: "regional" = "Local", not a separate feature

**Scope:** Docs-only correction. `docs/status.md`'s backlog previously
carried "Devices: regional registration" as a still-not-done feature
(mirroring the old app's `register-regional-device.php`). Project owner
clarified: "regional" was just the old PHP app's name for what this
rewrite now calls **Local**. It is not a separate registration flow to
build — Local already uses the standard registration form (per session 8's
clarification that Local/Intra registration stays identical for now).

**Changed:**
- `docs/status.md` — removed "regional registration" as a pending item;
  reworded the nearby "regional-specific validation not ported" deviation
  note (session 4) to record that it's moot, not outstanding; manufacturer
  lookup and reveal-outlook-password remain separate NOT-done items,
  decoupled from the word "regional"; "To resume" candidate list updated
  to stop suggesting "regional device registration" as a thing to build.

**No code changes this entry** — earlier commit-log entries (sessions 3–4)
still say "regional" because that was the accurate term for the old app at
the time; left as historical record, not rewritten.

---

## 2026-09-25 (8) — Guide placeholder + Local/Intra meaning clarified

**Scope:** Added a third "Guide" item under both Local and Intra sidebar
groups (blank placeholder page). Clarified in docs what Local vs. Intra
actually means, per project owner: the difference is in how computers get
*configured* in real life, not in how they're registered/managed in this
app — registration and management stay identical between the two groups
for now.

**Changed:**
- `src/app/(app)/guide/page.tsx` — new blank placeholder page ("Content
  coming later"), shared route (`/guide`) linked from both Local and Intra.
- `src/lib/nav.ts` — `deviceItems` (shared children of both Local and
  Intra) gained a third entry, "Guide" → `/guide`, `BookOpen` icon. Doc
  comment above `getNavGroups` rewritten to record the clarified Local/
  Intra meaning so a future session doesn't have to re-derive it.
- `docs/status.md` — Local/Intra item rewritten with the clarification and
  the Guide addition.

**Verified:** Not run through `tsc` — no `node_modules`/network in this
session (same sandbox limitation as always). Reviewed by eye; changes are
additive and isolated to nav/guide. **Run `npx tsc --noEmit` locally before
trusting this compiles.**

**Not verified:** not run against a live DB, not seen in a browser.

**Known deviations / explicitly not done:**
- Still nav-structure-only: Local and Intra point at the identical
  `/devices/register`, `/devices`, and now `/guide` routes. No field or
  logic exists anywhere to actually distinguish a "Local" device from an
  "Intra" device — that's explicitly deferred ("we'll update them later to
  make them quicker").
- `/guide` content is intentionally empty — project owner said to leave it
  blank and finish it at the end.

---

## 2026-09-25 (7) — CLAUDE.md paths resolved + Local/Intra sidebar split

**Scope:** Two unrelated small changes bundled in one delivery: (1) filled in
the `CLAUDE.md` delivery-workflow placeholders with the project owner's
confirmed paths; (2) restructured the sidebar so Register Device / Manage
Devices sit under two new collapsible groups, "Local" and "Intra".

**Changed:**
- `CLAUDE.md` — `<DOWNLOADS_FOLDER>` → `D:\Chrome_Downloads`,
  `<LOCAL_REPO_PATH>` → `D:\Chrome_Downloads\MIS_Sys`, both PowerShell
  template snippets updated; GitHub repo URL noted as active.
- `docs/status.md` — deviation #1 marked resolved; new "Local / Intra split"
  item added under "In progress / not started".
- `src/lib/nav.ts` — `NavItem` gained an optional `children?: NavItem[]`
  (and `href` became optional for parent/group items). `Workspace` group now
  has two parent items, "Local" (`MapPin` icon) and "Intra" (`Network`
  icon), each with the same `deviceItems` children (Register Device, Manage
  Devices) that used to be flat in the group.
- `src/components/Sidebar.tsx` — added collapsible-group rendering: a
  `NavItem` with `children` renders as a toggle button (chevron
  down/right, default expanded) instead of a link; its children render
  indented underneath. Plain items render exactly as before.

**Verified:** Not run through `tsc` — no `node_modules`/network in this
session (same sandbox limitation as always). Reviewed by eye; only two
files touched, both isolated to nav/sidebar. **Run `npx tsc --noEmit`
locally before trusting this compiles.**

**Not verified:** not run against a live DB, not seen in a browser.

**Known deviations / explicitly not done:**
- This is a **nav-structure-only** change. Local and Intra currently point
  at the identical `/devices/register` and `/devices` routes — there is no
  separate data, permissions, or page behind each group yet. The project
  owner has said this is deliberate for now ("the rest stays the same, we
  update it later") but the real split (what makes a device "Local" vs.
  "Intra" — separate routes? a field on the device? separate permissions?)
  is an open design question, not yet decided.
- Scoped to Devices only (Register Device / Manage Devices). Other sidebar
  sections (Work Queue, Users, Administration group) were left untouched —
  confirm before assuming they should also move under Local/Intra.

---

## 2026-09-25 (6) — Users management feature

**Scope:** Manage Users list, add, edit, activate/deactivate, reset password,
delete (technician-only, matching the original exactly). Profile image
upload and the self-service `profile.php` page are NOT done.

**Changed:**
- `src/lib/user-validation.ts` — shared full-name/username/password
  validators, ported from the regexes in `add-user.php`/`edit-user.php`
- `src/app/api/users/route.ts` — `POST` create user: Secondary-Admin
  singleton check, duplicate username check, bcrypt hash via
  `hashPassword()`, audit log
- `src/app/api/users/[id]/route.ts` — `PATCH` edit (duplicate check, "last
  Admin can't be demoted" guard, self-demotion guard, diff-based no-op
  detection, audit log); `DELETE` — **exactly mirrors the original**: only
  soft-deletes Technician accounts (`is_active=false`, `deleted_at` set),
  unassigns their repair jobs first. Admin/Reception/Secondary Admin
  accounts cannot be deleted through this endpoint, by design, same as
  `delete-user.php`.
- `src/app/api/users/[id]/status/route.ts` — activate/deactivate, "last
  active Admin can't be deactivated" guard, self-deactivation guard
- `src/app/api/users/[id]/reset-password/route.ts` — Admin-driven password
  reset, audit log
- `src/app/(app)/users/page.tsx` — list: role-count badges, search, table
  ordered Admin → Secondary Admin → Reception → Technician then name
- `src/components/users/UserRowActions.tsx` — edit link, activate/
  deactivate, reset-password modal, delete modal (Technician rows only) —
  **simplification**: original has separate pages for reset-password;
  this port uses an inline modal from the list instead. Same validation,
  fewer clicks.
- `src/app/(app)/users/add/page.tsx` + `src/components/users/AddUserForm.tsx`
- `src/app/(app)/users/[id]/edit/page.tsx` + `src/components/users/EditUserForm.tsx`

**Verified:** `npx tsc --noEmit` — clean

**Not verified:** not run against a live DB

**Known deviations, called out explicitly:**
- **Profile image upload is NOT ported** — `add-user.php`/`edit-user.php`
  both handle a `profile_image` file upload via
  `includes/profile-images.php`, persisting into the still-unmapped
  `user_profile_images` table. This needs a decision (see status.md) before
  it can be built: keep base64-in-DB, or move to real file/object storage.
- Self-service `profile.php` (a user editing their own name/password) is
  NOT done — Manage Users only covers Admin-driven user management.
- Same `FOR UPDATE` row-locking gap as devices/repairs — noted, not
  re-explained here.
- Reset-password UX intentionally simplified into a modal rather than a
  separate page (see above) — functionally equivalent, fewer files.

---

## 2026-09-24 (5) — Repairs / Work Queue feature

**Scope:** Migrated the technician work queue: list + status filter + search,
"current focus" spotlight (oldest unfinished job), per-status update form,
and Admin-only technician assignment.

**Changed:**
- `src/lib/repair-deadlines.ts` — `validExpectedCompletionDate()`, ported
  from `includes/repair-deadlines.php`. **Not ported:** `syncRepairDeadlines()`
  (the overdue-notification generator + schema-guard) — that's a
  background/cron-style routine, not a page, and needs a decision on where
  it runs in the new stack (see status.md).
- `src/app/(app)/work-queue/page.tsx` — list, role-scoped (Secondary Admin →
  own `assigned_secondary_admin_id`, Technician → own `assigned_technician_id`),
  search, status filter, status totals, and the "current focus" card (oldest
  active job) — ported from `work-queue.php`
- `src/app/(app)/repairs/[id]/page.tsx` +
  `src/components/repairs/UpdateRepairForm.tsx` — the update-repair form:
  diagnosis, repair notes, status, expected completion date, accessory
  returns — ported from `update-repair.php`
- `src/app/api/repairs/[id]/route.ts` — the update transaction: diff-based
  no-op detection, accessory-returns logic (can't "return" what wasn't
  received), `ready_at`/`delivered_at` timestamps, status_history insert,
  **auto-generates a Ready/Delivery receipt on those status transitions**
  (reuses an existing one if already generated, matching the original),
  audit log, technician→admin notification
- `src/app/(app)/repairs/[id]/assign/page.tsx` +
  `src/components/repairs/AssignTechnicianForm.tsx` +
  `src/app/api/repairs/[id]/assign/route.ts` — Admin-only technician /
  secondary-admin assignment, ported from `assign-technician.php`
- Work Queue and Manage Devices rows now link to `/repairs/[id]` (update),
  `/repairs/[id]/assign` (Admin), and `/devices/[id]` (view)

**Verified:** `npx tsc --noEmit` — clean

**Not verified:** not run against a live DB

**Known deviations, called out explicitly:**
- Same `FOR UPDATE` row-locking gap as devices edit/delete — the original
  locks the repair_job and accessories rows during the update transaction;
  this port doesn't, for the same Prisma-transaction reason.
- `syncRepairDeadlines()` (auto-generates "repair_overdue" notifications for
  every job past its deadline, run on every original page load as a
  side-effect) is **not ported**. This needs a real decision: a scheduled
  job/cron, an API route triggered by a scheduler, or something else —
  flagging rather than guessing.
- Work Queue's list query is capped at 200 rows and the "current focus" scan
  at 50 (no pagination yet, unlike Manage Devices) — fine for now, revisit
  if a real installation's active queue gets large.

---

## 2026-09-24 (4) — Devices feature: view, edit, delete

**Scope:** Finished the devices feature. Regional registration and
manufacturer-lookup/reveal-password are still NOT done.

**Changed:**
- `src/lib/devices.ts` — `loadDeviceForRole()`, shared role-scoped device
  loader (Secondary Admin restricted to their assigned devices) used by
  view/edit
- `src/app/(app)/devices/[id]/page.tsx` — device detail view: customer,
  device, reported problem/diagnosis/notes, accessories, timeline, status
  history, receipts, WhatsApp message log — ported from `view-device.php`
- `src/app/(app)/devices/[id]/edit/page.tsx` +
  `src/components/devices/EditDeviceForm.tsx` — edit UI, prefilled from
  current data, reported-problem type inferred from stored text (mirrors
  `reportedProblemFormState()`)
- `src/components/devices/DeleteDeviceButton.tsx` — delete confirmation
  modal with required reason (10-500 chars), shown only to Admin/Technician
- `src/app/api/devices/[id]/route.ts`:
  - `PATCH` — edit transaction: duplicate check (excluding self), diff
    against current values to skip no-op saves, updates customer/repair_job/
    accessories, audit log (`device_edited`), and — when the actor is a
    Technician — notifies all Admins, mirroring
    `notifyAdminsOfTechnicianChange()` in
    `includes/device-change-notifications.php`
  - `DELETE` — role-gated to Admin/Technician, requires a reason, audit-logs
    a full snapshot before deleting, removes dependent records
    (whatsapp_logs, receipts, status_history, accessories) then the
    repair_job, deletes the customer only if no other repair job still
    references them, and notifies Admins when a Technician does the delete
- `src/app/(app)/devices/page.tsx` — Job ID in the list now links to the
  view page

**Verified:** `npx tsc --noEmit` — clean (more stopgap `any` typing needed,
same root cause as before — see prior entry)

**Not verified:** not run against a live DB

**Known deviations, called out explicitly:**
- The original wraps the edit/delete reads in `SELECT ... FOR UPDATE` row
  locks inside the transaction. Prisma's interactive transactions don't
  expose raw row locking without dropping to `$queryRaw`, so this port
  relies on the transaction's default isolation instead. Under concurrent
  edits to the *same* device this is a real (if narrow) behavior gap from
  the original — flag if that matters before going to production.
- Edit validation ported the core rules (title, name length, phone digit
  count, email format, string lengths) but not the full set of
  regional-registration-specific conditional rules — regional registration
  itself isn't built yet, so this will need a revisit when it is.

---

## 2026-09-24 (3) — Devices feature: register + manage (list)

**Scope:** Migrated device registration and the device list/search page.
Standard (non-regional) registration only — regional registration
(`register-regional-device.php`), edit, view, and delete are NOT done yet.

**Changed:**
- `src/lib/credentials.ts` — AES-256-GCM encrypt/decrypt, byte-compatible
  with `includes/credentials.php` (same base64(iv+tag+ciphertext) format).
  Reads `CREDENTIAL_KEY` from env — **must be the same key value as the
  original PHP app's**, or existing encrypted Outlook passwords won't
  decrypt. Added to `.env.example`.
- `src/lib/reported-problems.ts` — ported from `includes/reported-problems.php`
- `src/lib/reference.ts` — `generateUniqueReference()`, ported from
  `register-device.php`
- `src/lib/api-auth.ts` — `requireApiRoles()` helper for API routes, mirrors
  `requireRoles()` in `includes/auth.php`
- `src/app/api/devices/register/route.ts` — full registration transaction:
  role check, validation, duplicate detection (barcode/serial/MAC/hostname),
  customer create, repair_job create, accessories, status_history, receipt,
  audit_log, and technician→admin notification — all ported from
  `register-device.php`'s standard (non-regional) flow
- `src/app/(app)/devices/register/page.tsx` +
  `src/components/devices/RegisterDeviceForm.tsx` — registration UI
- `src/app/(app)/devices/page.tsx` — Manage Devices list: search, status
  filter, technician filter, pagination (10/page), role-scoped (Secondary
  Admin sees only their assigned devices) — ported from `manage-devices.php`

**Verified:** `npx tsc --noEmit` — clean (after adding explicit types to
work around the stub Prisma client — see note below)

**Not verified:** not run against a live DB (same sandbox limitation)

**Known deviations, called out explicitly:**
- Search is simpler than the original: the PHP version also runs a
  second pass with punctuation stripped from barcodes/serials so
  `"AUC-123"` matches a search for `"AUC123"`. This port only does a plain
  case-insensitive `contains` match. Add the normalized-search pass back if
  exact-match-ignoring-punctuation search matters.
- `Prisma` namespace types (`Prisma.RepairJobWhereInput` etc.) aren't
  available because `prisma generate` still hasn't run against a real
  network — used explicit `any`-based types as a stopgap in
  `src/app/(app)/devices/page.tsx` and the register route. **Once
  `npx prisma generate` runs in a real environment, revisit these and
  swap in the real `Prisma.*` types** for proper type safety.
- NOT done this session (still in `docs/status.md`): regional device
  registration, edit-device, view-device, delete-device, manufacturer
  lookup, reveal-outlook-password.

---

## 2026-09-24 (2) — Real CLAUDE.md + sidebar/nav shell

**Scope:** Replaced draft CLAUDE.md with project owner's real template;
built the shared authenticated layout (sidebar + role-based nav)

**Changed:**
- `CLAUDE.md` — replaced draft with the project owner's real template,
  filled in project-specific sections (Domain conventions, Tech stack,
  Things Claude should never do). **`<DOWNLOADS_FOLDER>` and
  `<LOCAL_REPO_PATH>` still need the project owner's actual values** —
  the delivery-workflow PowerShell snippets can't be generated correctly
  until those are provided.
- `src/lib/nav.ts` — nav item config, role-visibility ported exactly from
  `Arp-main/includes/sidebar.php` (verified against the full file this time,
  not just an excerpt)
- `src/components/Sidebar.tsx` — new sidebar UI: active-link highlighting,
  unread-notification badge, profile summary, logout
- `src/app/(app)/layout.tsx` — shared layout for all authenticated pages,
  fetches session + unread count server-side
- `src/app/(app)/dashboard/page.tsx` — moved dashboard into the `(app)`
  route group (URL unchanged, still `/dashboard`)
- `src/app/api/auth/logout/route.ts` — logout endpoint
- Added `lucide-react` dependency (icons, matches original's lucide usage)

**Verified:** `npx tsc --noEmit` — clean

**Not verified:** not run against a live DB/browser (same sandbox network
limitation as before)

**Intentionally deferred (in original sidebar, not ported yet — flag if
this matters to the project owner):**
- Dark mode toggle, font-size selector, high-contrast toggle
  (`includes/sidebar.php`'s "Display settings" panel)
- Credits/acknowledgments modal
- Mobile nav collapse/hamburger behavior — current sidebar is desktop-only
  layout, not yet responsive for small screens

---

## 2026-09-24 — Project scaffold + auth migration

**Scope:** Initial Next.js/TypeScript/Prisma scaffold; first migrated feature (login + session)

**Changed:**
- New project scaffold: `package.json`, `tsconfig.json`, `next.config.ts`,
  `tailwind.config.ts`, `postcss.config.js`, `.env.example`, `.gitignore`
- `prisma/schema.prisma` — translated from `Arp-main/database/schema.sql`.
  Models mapped: `User`, `LoginAttempt`, `Customer`, `RepairJob`,
  `Accessories`, `StatusHistory`, `Receipt`, `WhatsappLog`, `AuditLog`,
  `Notification`, `PasswordResetToken`.
  **Not yet mapped:** `user_profile_images` table (base64 image blobs in DB —
  needs a decision: keep as-is in Prisma, or move to filesystem/object
  storage as part of the rewrite).
- `src/lib/prisma.ts` — Prisma client singleton
- `src/lib/auth.ts` — session cookie (JWT via `jose`), PHP-bcrypt-compatible
  password verification (`$2y$` → `$2b$` prefix normalization), password
  hashing for new users
- `src/app/api/auth/login/route.ts` — login endpoint: username/password
  check, progressive lockout via `login_attempts` table, sets session cookie
- `src/app/login/page.tsx` — new login UI
- `src/app/dashboard/page.tsx` — placeholder authenticated landing page
- `src/app/page.tsx` — root redirect (session → dashboard, else → login)
- `src/middleware.ts` — route protection, mirrors `includes/auth.php`
  redirect-to-login behavior
- `CLAUDE.md`, `docs/status.md` — project rules + continuity doc

**Verified:**
- `npm install` — clean
- `npx tsc --noEmit` — clean, no type errors

**Not verified (sandbox network restrictions — needs a real environment):**
- `npx prisma generate` / `migrate` — blocked, `binaries.prisma.sh` not
  reachable from this sandbox
- `npm run dev` / actual login flow against a real Postgres DB
- `npm run build`

**Known gaps / deviations from original, called out explicitly:**
- Lockout duration tiers in `lockDurationSeconds()` (`src/lib/auth.ts`) are
  a best guess (30s/60s/5m/15m/1h escalating) — **not yet verified against**
  the full original `app/pages/auth/login.php` (only the first ~80 lines
  were read). Verify before treating this as correct.
- CSRF protection was dropped — Next.js API route + `SameSite=Lax` cookie +
  POST-only gives baseline protection, but the original used an explicit
  CSRF token. Decide if that's still needed here.
- Forgot-password flow not yet migrated (`/forgot-password` link is a dead
  route for now).
