# Project Status

Last updated: 2026-09-26 (session 18)

## What this project is
Rewriting `Arp-main` (PHP + PostgreSQL device-repair management system) into
Next.js 14 (App Router) + TypeScript + Prisma + Tailwind, targeting the same
Postgres database (no data migration). Feature-by-feature, old app is the
behavior reference until each page's replacement ships.

Read `CLAUDE.md` first for the working rules. Read `docs/commit-log.md` for
exactly what's changed, in order. This file is the current snapshot.

## Done
- [x] Project scaffold (Next.js, TS, Tailwind, Prisma) — builds and
      typechecks (`npx tsc --noEmit` clean)
- [x] Prisma schema translated from `database/schema.sql` (see gaps below)
- [x] Auth: login page + API route + session cookie + route-protection
      middleware, PHP-bcrypt-compatible password verification, login lockout
- [x] Sidebar/nav shell — role-based nav (`src/lib/nav.ts`,
      `src/components/Sidebar.tsx`), shared authenticated layout
      (`src/app/(app)/layout.tsx`). Desktop-only for now; dark mode, font
      settings, high-contrast toggle, and credits modal deliberately
      deferred (see commit-log for full list) — not silently dropped, just
      not prioritized yet.
- [x] Real `CLAUDE.md` received and applied — draft is gone
- [x] Devices: register (standard flow) + manage-devices list/search/filter/
      pagination. See commit-log for exact deviations (search normalization,
      stopgap `any` types pending real `prisma generate`).
- [x] Devices: view, edit, delete. See commit-log for deviations (no
      `FOR UPDATE` row locking; the old PHP app's separate "regional"
      registration validation rules were never ported — moot now, see
      note below: "regional" was just the old name for "Local", which
      uses the standard registration flow, not a special one).
- [x] Repairs: work queue, update-repair, assign-technician. See commit-log.
- [x] Repair-deadline background sync — `syncRepairDeadlines()` ported to
      `src/lib/repair-deadlines.ts`, exposed as a secret-protected scheduled
      endpoint (`GET`/`POST /api/cron/sync-repair-deadlines`), NOT tied to
      page loads. **Needs an external scheduler configured** (Railway Cron
      Job or similar) before it actually runs — see commit-log session 12
      for the full decision and setup steps.
- [x] Devices: manufacturer lookup, reveal-outlook-password. See commit-log
      session 13 for the one carried-over inconsistency (reveal button
      visible to Secondary Admin, endpoint denies them — matches original).
- [x] Users: manage list, add, edit, activate/deactivate, reset password,
      delete (Technician-only, matching original). See commit-log — profile
      image upload and self-service profile page NOT done.
- [x] Forgot / reset password flow. See commit-log — consolidated the
      original's two-page forgot-password flow (form page + separate
      "sent" page) into one page with client-side state; no functional
      change, just fewer routes. `/login`'s "Forgot your password?" link
      now goes somewhere real.
- [x] Real dashboard (replaces the `/dashboard` placeholder). See
      commit-log for exact deviations: notification bell/popover
      intentionally left out (tied to the already-deprioritized
      Notifications feature, see below); "Recent activity" panel shows
      exactly one item, matching the original's `LIMIT 1` — flag if that
      was actually meant to be a longer feed; "Register Device" quick
      action is hidden for Secondary Admin (the original showed it to
      everyone, but that role gets redirected away from the page anyway —
      this closes a dead-end click, not a dropped permission).

- [x] Render deployment prep — `render.yaml` blueprint (native Node
      runtime, no Dockerfile needed), `GET /api/health` (ported from
      `health.php`), and a self-ping loop (`src/instrumentation.ts`,
      ported from `docker-entrypoint.sh`'s background loop) to stop
      Render's free tier from spinning the service down after 15 minutes
      idle. See commit-log session 14 — also fixes a pre-existing bug
      (`next.config.ts` isn't valid until Next.js 15; this app is on 14.x)
      that would have failed `next build` regardless of hosting target.
      **Not yet actually deployed** — see commit-log session 14 for the
      manual steps still needed (create the Render service, set secrets).

- [x] Receipts: preview page + printed tracking (session 16). See
      commit-log for exact deviations (Tailwind layout instead of pixel-for-
      pixel `receipt.css` port; PDF export not included, see below).
- [x] WhatsApp message prep (session 17) — `/devices/[id]/whatsapp?type=`,
      `POST /api/devices/[id]/whatsapp`. See commit-log for the one
      carried-over inconsistency (deviation #14): the "Prepare Message"
      button is visible to Secondary Admin on the device page but the
      page/endpoint both deny that role, same pattern as deviation #10.
- [x] Notifications (list, mark-read, mark-all-read) — `src/app/(app)/notifications`,
      `src/app/api/notifications`. Previously listed as deprioritized; done.
- [x] Reports overview + Audit History (filters + pagination) —
      `src/app/(app)/reports`, `src/app/(app)/audit-history`.
- [x] Self-service profile page + profile photo upload/remove —
      `src/app/(app)/profile`, `src/app/api/profile`. `user_profile_images`
      mapped in Prisma (base64-in-DB, decided rather than moving to object
      storage).
- [x] Reports: real server-generated PDF export (session 18, replaces the
      original's browser-print approach) — `src/lib/reports/generate-report-pdf.ts`,
      `GET /api/reports/export-pdf` (pdfkit). See commit-log.
- [x] System backups UI (session 18) — on-demand, stream-only (no local
      disk — Render free tier has no persistent disk). `src/lib/backups/generate-backup.ts`,
      `GET /api/system/backup`, `src/app/(app)/system-backups`. No backup
      history list (decision: Neon's own automated backups cover that
      need). See commit-log.
- [x] Local / Intra split (session 18) — Register/Manage remain identical
      shared routes between the two groups (unchanged decision from
      2026-09-25). What now differs: Guide content points at separate
      `/guide/local` / `/guide/intra` routes (still placeholder — **waiting
      on project owner to bring the actual content**), and the shared
      Register Device form gained one optional field, Regional Office,
      wired to the previously-unused `Customer.regionalOffice` column.

## In progress / not started
- [ ] **WhatsApp auto-send needs a real deploy + QR scan to verify.** Built
      session 19 (see commit-log): Received/Ready messages now auto-send via
      `whatsapp-web.js`, session persisted to the new `whatsapp_sessions`
      table. Nothing here was tested against a live WhatsApp session or a
      live Render deploy — go to Administration → WhatsApp Setup, scan the
      QR with the dedicated second number, then register a test device /
      move one to Ready and confirm both the message arrives and
      `whatsapp_logs` shows `Sent`. If the paired number gets flagged/banned
      by WhatsApp (a real risk with this approach), the manual wa.me flow on
      the other number is unaffected.
- [ ] Global admin search bar (`includes/admin-search*.php`) — cross-record
      search across the admin UI. Not the same as the per-page search boxes
      already ported on Audit History / Reports. Genuinely not started;
      flagging rather than silently dropping it.
- Everything else from the original PHP page list has a ported equivalent
  as of session 18. What's left otherwise is content, not code: the
  Local/Intra Guide pages are empty placeholders until the project owner
  supplies the actual guide content.

## Known deviations / decisions needed from project owner
1. ~~`CLAUDE.md`'s `<DOWNLOADS_FOLDER>` and `<LOCAL_REPO_PATH>` placeholders~~
   — **resolved 2026-09-25**: confirmed as `D:\Chrome_Downloads` and
   `D:\Chrome_Downloads\MIS_Sys`. `CLAUDE.md` updated accordingly.
2. `lockDurationSeconds()` lockout tiers in `src/lib/auth.ts` are a
   best-effort guess — only read the first ~80 lines of
   `app/pages/auth/login.php`. **Verify against the full file** before
   relying on this.
3. CSRF token from the original login form was dropped in favor of
   SameSite cookies. Confirm this is acceptable, or bring CSRF back.
4. This container has restricted network access (npm registry only) —
   `npx prisma generate` could not be run here (blocked fetching Prisma's
   engine binary). **Run `npm install && npx prisma generate` in a real
   environment before trusting the Prisma layer compiles/works.**
5. No live Postgres connection was available here — the login flow has
   not been tested against a real database yet.
6. Forgot/reset password is an **internal, no-email system by design**
   (matches the original exactly): there's no mail server integration —
   the reset link is generated and handed straight back to whoever
   submitted the form, same as the original PHP app showing it on the
   `forgot-password-sent.php` page. This was not a decision made during
   the rewrite; it's carried over as-is. Flag if the project owner wants
   real email delivery added as a *new* feature (out of scope for this
   port).
7. Same npm/network restriction as deviation #4 — this session's new
   `/api/auth/forgot-password`, `/api/auth/reset-password` routes and the
   `/forgot-password`, `/reset-password` pages were not run through
   `npx tsc --noEmit` (no `node_modules` in this sandbox). Written to
   match the exact patterns already verified working elsewhere in this
   codebase (same Prisma transaction shape as
   `api/users/[id]/reset-password/route.ts`, same `x-forwarded-for` IP
   extraction as `api/auth/login/route.ts`). **Run `npx tsc --noEmit`
   locally before trusting this compiles.**
8. **`audit_logs.action_type` naming has drifted from the original PHP
   app**, discovered while building the dashboard's recent-activity feed.
   The original writes `CREATE`, `UPDATE`, `STATUS_CHANGE`,
   `REPAIR_UPDATE`, `ASSIGN_TECHNICIAN`, `device_deleted`,
   `password_reset`. This rewrite (across earlier sessions) instead
   writes `CREATE` (device register only), `device_edited`,
   `device_deleted`, `repair_updated`, `technician_assigned`,
   `technician_reassigned`, `user_created`, `user_edited`,
   `user_reactivated`, `user_deactivated`, `password_reset` — a mix of
   old and new names, not consistent either with the original or within
   itself. Nothing broke (the dashboard's activity labels are keyed to
   what's actually written, with a title-cased fallback for anything
   unmapped, same as the original's own fallback), but if `audit_logs` is
   ever queried or reported on by raw `action_type` value (e.g. the
   not-yet-built Audit History page), this inconsistency will surface
   there too. Worth a deliberate decision — and a one-time
   find-and-replace — rather than leaving it to drift further.
9. **Repair-deadline sync needs a scheduler wired up before it does
   anything.** `syncRepairDeadlines()` is ported and exposed at
   `/api/cron/sync-repair-deadlines`, but nothing calls it yet — no
   overdue notifications will be generated until `CRON_SECRET` is set in
   the deployment env and an external scheduler (Railway Cron Job,
   GitHub Actions cron, cron-job.org, etc.) is pointed at that URL on a
   recurring basis (daily is probably enough, since deadlines are dates
   not times). See commit-log session 12 for the full reasoning on why
   this is a standalone endpoint rather than tied to page loads.
10. **A role-visibility inconsistency in the original was carried over
    deliberately, not fixed.** On the device detail page, the "Show"
    button for the Outlook password is visible to all four roles that can
    view the page (Admin, Secondary Admin, Reception, Technician) — same
    as the original. But the reveal endpoint itself only allows Admin,
    Reception, Technician (also matching the original exactly) — so a
    Secondary Admin sees the button but gets a 403 if they click it. Per
    CLAUDE.md ("never silently drop a role-visibility rule when porting a
    page"), this port keeps that exact behavior rather than guessing
    which side was the "real" intent. Flag if the project owner wants it
    resolved one way or the other.

11. **Deployment target corrected from Railway to Render, 2026-09-25.**
    `CLAUDE.md` and earlier commit-log entries (sessions 1 and 12) said
    Railway, following `Arp-main/railway.json`. Building the actual
    deploy config surfaced that `Arp-main/docker-entrypoint.sh` and
    `Arp-main/health.php` explicitly reference "Render's free tier" in
    their own comments — the original app is really deployed on Render;
    `railway.json` looks like a leftover from an earlier/abandoned
    attempt. `CLAUDE.md`'s "Tech stack / architecture" section is updated
    accordingly. Flag if this reading is wrong — i.e. if Railway actually
    is (or is going to be) the real target.
12. **Pre-existing bug found and fixed while building deploy config:**
    `next.config.ts` is not valid on Next.js 14 (TypeScript config files
    were only added in Next.js 15) — `next build` failed immediately with
    `Configuring Next.js via 'next.config.ts' is not supported`, before
    ever reaching any application code. This has been present since the
    original scaffold (session 1) and would have blocked deployment to
    *any* host, not just Render — it was never caught because `next
    build` had never actually been run (every prior session's sandbox
    lacked network access to even get that far, per deviation #4).
    Replaced with `next.config.js` (session 14). **This sandbox still
    can't reach `binaries.prisma.sh`** (deviation #4, still open), so
    `next build` here gets as far as "Collecting page data" — past
    typecheck and compile — before failing solely on the missing Prisma
    engine binary. Run `npm run build` in a real environment to confirm
    it completes end-to-end.

13. **Receipts preview (session 16) is a Tailwind re-layout, not a pixel
    port of `assets/css/receipt.css`.** All the same fields, sections, and
    role/scoping rules are there (Admin/Reception/Technician only, a
    Technician further scoped to their own assigned jobs — Secondary Admin
    gets no link and no route access at all, unlike the Outlook-password
    button's carried-over inconsistency in deviation #10), and it still
    prints cleanly via the browser (`window.print()`), but the exact visual
    styling (gradients, spacing, the specific `official-receipt` CSS
    classes) was rebuilt with Tailwind utilities to match the rest of this
    app rather than copied line-for-line from the old CSS file. Flag if
    pixel-identical output is actually required (e.g. printed receipts are
    compared side-by-side with old ones, or a fixed paper size/margins
    matters). Also note: the original status-doc line for this item
    bundled in "PDF export" via `export-report-pdf.php` — that file is
    actually part of the **Reports** page (`requireRoles(['Admin'])`,
    builds a full system report, not a single receipt), not a receipts
    feature. There is no separate receipt-to-PDF endpoint in the original;
    receipts were only ever printed via the browser dialog. PDF export has
    been moved to the Reports item accordingly.

14. **WhatsApp message prep (session 17) carries over a Secondary-Admin
    button/endpoint visibility gap, same pattern as deviation #10.**
    `view-device.php` allows Secondary Admin (`requireRoles(['Admin',
    'Secondary Admin', 'Reception', 'Technician'])`) and unconditionally
    shows the "Prepare Message" action bar when the job's status is
    Received/Ready/Delivered, but `whatsapp-message.php` itself only allows
    Admin/Reception/Technician. So a Secondary Admin sees the button on the
    device page and gets denied on click (page redirect / 403 from the API
    route) — carried over exactly, not fixed, per CLAUDE.md. Also note: the
    original's SQL for this feature has **no** Technician-scoping clause
    (unlike receipts, which does restrict a Technician to their own
    assigned jobs) — any Technician can prepare a WhatsApp message for any
    repair job. That's intentional-as-found, not an omission in this port.

## To resume in a new chat
1. Share this repo (or re-upload the zip) plus `Arp-main` for reference.
2. Point the new chat at this file and `CLAUDE.md`.
3. Say which item from "In progress / not started" to pick up next.
   Notifications and profile images are explicitly deprioritized (see
   above). Repair-deadline sync, manufacturer lookup / reveal-outlook-
   password, Receipts preview/print, and WhatsApp message prep are all
   built — see deviations #9, #10, #13, and #14 above for what's still open
   on each. Good next candidate: Reports + audit history — decide
   deviation #8's `audit_logs` naming drift first, since that page is the
   first thing that would actually query by `action_type`.
4. Before migrating any feature, read its original PHP file(s) listed above
   — don't reimplement from assumption.
