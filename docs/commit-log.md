# Commit Log

Append one entry per work session/commit. Newest at the top.

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
