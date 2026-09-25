# Project Status

Last updated: 2026-09-25 (session 13)

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

## In progress / not started
- [ ] **Local / Intra split** — sidebar groups Register Device / Manage
      Devices / Guide under two collapsible parent items, "Local" and
      "Intra" (`src/lib/nav.ts`, `src/components/Sidebar.tsx`). Clarified
      2026-09-25: the real-world difference is in how the computers
      themselves get *configured* (different for Local vs. Intra setups) —
      **not** in how they're registered or managed in this app, which stay
      identical for now ("we'll update them later to make them quicker").
      So this is still nav-structure-only: both groups point at the exact
      same `/devices/register` and `/devices` routes, no separate data or
      permissions yet. A third child, **Guide** (`/guide`), was added under
      both groups as an intentionally blank placeholder — content to be
      written later, no design decision needed yet.
- [ ] **Deprioritized by project owner (2026-09-25):** Profile image upload
      and Notifications (list, mark read) — profile photos aren't actually
      used in practice, and notifications aren't a current priority. Left in
      this list for completeness but not next up.
- [ ] Profile image upload (`includes/profile-images.php`,
      `user_profile_images` table) — blocks add-user/edit-user profile
      photos. Needs a decision: keep base64-in-DB or move to file/object
      storage, THEN map `user_profile_images` in Prisma, THEN wire up the
      upload UI.
- [ ] Self-service profile page (`profile.php`) — a user editing their own
      name/password/photo. Different from admin-driven Manage Users.
- [ ] `user_profile_images` table not yet mapped in Prisma — decide: keep
      base64-in-DB as-is, or move profile images to filesystem/object
      storage as part of the rewrite (original: `includes/profile-images.php`)
- [ ] Notifications (list, mark read/all read) — deprioritized, see above
      (original: `notifications.php`, `mark-notification-read.php`,
      `mark-all-notifications-read.php`,
      `includes/device-change-notifications.php`)
- [ ] Receipts: preview, printed tracking, PDF export
      (original: `receipt-preview.php`, `mark-receipt-printed.php`,
      `export-report-pdf.php`)
- [ ] WhatsApp message prep (`whatsapp-message.php`)
- [ ] Reports + audit history (`reports.php`, `audit-history.php`)
- [ ] Admin search (`includes/admin-search*.php`)
- [ ] System backups UI (`system-backups.php`, `includes/backup-engine.php`
      — this one is 24KB, review carefully before touching)
- [ ] Sidebar/nav → modern layout shell, role-aware
      (original: `includes/sidebar.php`, 20KB — defines the full nav/role
      visibility rules, read this before building the new layout shell)
- [ ] Decide replacement for `whatsapp-message.php` (original stores an
      encrypted Outlook password per customer via `includes/credentials.php`
      — that encryption scheme is already ported and in active use, see
      `src/lib/credentials.ts` — `encryptCredential()` at device
      registration, `decryptCredential()` at reveal, session 13. This item
      is now just about the WhatsApp message-prep feature itself.)

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

## To resume in a new chat
1. Share this repo (or re-upload the zip) plus `Arp-main` for reference.
2. Point the new chat at this file and `CLAUDE.md`.
3. Say which item from "In progress / not started" to pick up next.
   Notifications and profile images are explicitly deprioritized (see
   above). Repair-deadline sync and manufacturer lookup / reveal-outlook-
   password are both built — see deviations #9 and #10 above for what's
   still open on each. Good next candidates: Receipts (preview/printed/
   PDF export), WhatsApp message prep, or Reports + audit history (the
   latter should probably wait on deciding deviation #8's audit_logs
   naming drift first, since it's the first feature that would actually
   query by `action_type`).
4. Before migrating any feature, read its original PHP file(s) listed above
   — don't reimplement from assumption.
