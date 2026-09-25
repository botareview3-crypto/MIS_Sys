# Commit Log

Append one entry per work session/commit. Newest at the top.

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
