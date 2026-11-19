# 2026-11-19 — Dark theme + Outside Tasks

(Kept as its own file instead of a new entry in `commit-log.md`; fold it in
there when convenient.)

**Scope:** (1) dark/charcoal colour theme for the whole app; (2) new
`/outside-tasks` section where every user logs work done outside the office.

**Dark theme**
- `tailwind.config.ts`: the `stone` scale and `brand-50/100/200/300/700` now
  read CSS variables; light values are the original palette (no change).
- `src/app/globals.css`: new variables + a "Dark theme" section at the bottom,
  active under `html[data-theme="dark"]`. Overrides `.card`, `.input`,
  `.btn-secondary`, hard-coded `bg-white*`, the sidebar gradient and the
  tinted red/green/amber/etc. pills. Receipts/handover sheets (`.a6-sheet`)
  stay light so printing is unchanged.
- `src/app/layout.tsx`: inline script sets the theme before first paint;
  default is dark, choice stored in `localStorage["mis-theme"]`.
- `src/components/ThemeToggle.tsx` + `TopBar.tsx`: sun/moon button next to the
  bell switches back to the original light look.
- Not seen in a browser. Any page with hard-coded colours that don't use the
  classes above may need a touch-up.

**Outside Tasks**
- SEPARATE DATABASE (a Neon project, `mis-outside-tasks`), not the shared
  production DB. Own schema `prisma/outside-tasks/schema.prisma` (client is
  generated into `src/generated/outside-client` by `postinstall`, git-ignored),
  own env var `OUTSIDE_TASKS_DATABASE_URL`, client in `src/lib/prisma-outside.ts`.
  Main `prisma/schema.prisma` unchanged. No foreign key to `users` (different
  DB): user id + full name are stored when the task is logged.
- Table already created; SQL kept in `prisma/outside-tasks/outside_tasks.sql`.
- Fields: user (from session), customer name, issue (dropdown), optional
  notes, `logged_at` set server-side (UTC) — the user never types the date.
  Issue list: `OUTSIDE_TASK_ISSUES` in `src/lib/outside-tasks.ts` (placeholder
  list, edit to the real jobs).
- Visibility: Admin + Secondary Admin see all entries (+ staff filter);
  Reception/Technician see only their own — enforced in the page query.
  All four roles can log entries (`POST /api/outside-tasks`).
- Dates display in Africa/Addis_Ababa time.
- Nav: "Outside Tasks" in Workspace for every role (`src/lib/nav.ts`).
- Page shows a friendly message if `OUTSIDE_TASKS_DATABASE_URL` is missing.

**Not verified:** `prisma generate`, `tsc`, `next build` were not run (no
network in the sandbox). Run `npm run build` before relying on it.
