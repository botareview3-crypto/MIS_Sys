# Project Status

Last updated: 2026-09-25 (session 6)

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
      `FOR UPDATE` row locking; regional-specific validation not ported).
- [x] Repairs: work queue, update-repair, assign-technician. See commit-log —
      `syncRepairDeadlines()` (overdue-notification background job) is NOT
      ported, needs a real decision on where scheduled jobs run in this stack.
- [x] Users: manage list, add, edit, activate/deactivate, reset password,
      delete (Technician-only, matching original). See commit-log — profile
      image upload and self-service profile page NOT done.

## In progress / not started
- [ ] Profile image upload (`includes/profile-images.php`,
      `user_profile_images` table) — blocks add-user/edit-user profile
      photos. Needs a decision: keep base64-in-DB or move to file/object
      storage, THEN map `user_profile_images` in Prisma, THEN wire up the
      upload UI.
- [ ] Self-service profile page (`profile.php`) — a user editing their own
      name/password/photo. Different from admin-driven Manage Users.
- [ ] Repair-deadline background sync (`syncRepairDeadlines()` in
      `includes/repair-deadlines.php`) — decide: cron, scheduled API route,
      or something else. Currently nothing generates "repair overdue"
      notifications in the new stack.
- [ ] Devices: regional registration, manufacturer lookup,
      reveal-outlook-password — NOT done, still needed
      (`register-regional-device.php`, `manufacturer-info.php`,
      `reveal-outlook-password.php`)
- [ ] `user_profile_images` table not yet mapped in Prisma — decide: keep
      base64-in-DB as-is, or move profile images to filesystem/object
      storage as part of the rewrite (original: `includes/profile-images.php`)
- [ ] Forgot password / reset password flow
      (original: `app/pages/auth/forgot-password.php`, `reset-password.php`)
- [ ] Dashboard (real one — current `/dashboard` is a placeholder)
      (original: `dashboard.php`, `reports.php` for dashboard stats)
- [ ] Repairs: work queue, assign technician, update repair, repair deadlines
      (original: `work-queue.php`, `assign-technician.php`,
      `update-repair.php`, `includes/repair-deadlines.php`,
      `includes/reported-problems.php`)
- [ ] Users: manage-users, add/edit/delete user, roles, profile,
      change-user-status, reset-user-password
      (original: `manage-users.php`, `add-user.php`, `edit-user.php`,
      `delete-user.php`, `profile.php`, `change-user-status.php`,
      `reset-user-password.php`)
- [ ] Notifications (list, mark read/all read)
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
- [ ] Decide replacement for `whatsapp-message.php` / `credentials.php`
      (original stores an encrypted Outlook password per customer — check
      `includes/credentials.php` for the encryption scheme before touching
      `customers.outlook_password_encrypted`)

## Known deviations / decisions needed from project owner
1. `CLAUDE.md`'s `<DOWNLOADS_FOLDER>` and `<LOCAL_REPO_PATH>` placeholders
   still need real values before the delivery-workflow PowerShell snippets
   in future turns will actually be correct for this machine.
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

## To resume in a new chat
1. Share this repo (or re-upload the zip) plus `Arp-main` for reference.
2. Point the new chat at this file and `CLAUDE.md`.
3. Say which item from "In progress / not started" to pick up next —
   recommend `Notifications` next (the sidebar badge already reads this
   table and several features already write to it), or the
   `user_profile_images` decision to unblock profile photos.
4. Before migrating any feature, read its original PHP file(s) listed above
   — don't reimplement from assumption.
