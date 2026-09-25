# Claude Rules — arp-next

Rules for any Claude session working on this project.

## Delivery workflow

When Claude makes code changes to this project (via chat, not directly against
the user's local files), the user needs a way to get those changes from the
delivered zip into their local git clone. Every time Claude delivers an
updated version of this project as a zip file, Claude must **also** provide
the PowerShell commands to unzip it and copy it into the local repo, using
these fixed paths:

- Downloaded zip lands in: `D:\Chrome_Downloads`
- Local git clone lives at: `D:\Chrome_Downloads\MIS_Sys` — confirmed by the
  project owner. GitHub repo: https://github.com/zementaye/MIS_Sys (active,
  everything delivered so far has been pushed).

Template to reuse (update `$zipPath` if the filename changes):

```powershell
# --- Paths ---
$zipPath    = "D:\Chrome_Downloads\arp-next-updated.zip"
$extractTo  = "D:\Chrome_Downloads\arp-next-updated"
$repoPath   = "D:\Chrome_Downloads\MIS_Sys"

# --- 1. Unzip the download (into its own temp folder first) ---
Expand-Archive -Path $zipPath -DestinationPath $extractTo -Force

# --- 2. Copy the extracted files into the git repo, overwriting existing ones ---
Copy-Item -Path "$extractTo\*" -Destination $repoPath -Recurse -Force

# --- 3. Clean up the temp extraction folder ---
Remove-Item -Path $extractTo -Recurse -Force

# --- 4. Stage, commit, and push ---
cd $repoPath
git status
git add -A
git commit -m "Describe the change here"
git push origin main   # or master - check with: git branch --show-current
```

Notes for Claude to keep in mind:
- Check the actual downloaded filename in `<DOWNLOADS_FOLDER>` before assuming
  it matches `$zipPath` exactly (browsers append ` (1)`, etc. on repeat
  downloads).
- `Copy-Item -Force` overwrites files but does not delete files that exist in
  the repo but not in the new zip.
- Never assume the default branch name — tell the user to confirm with
  `git branch --show-current` before pushing.

## File naming

Each delivered zip must have a unique filename — never reuse
`arp-next-updated.zip` from a prior delivery. Repeat downloads of
the same filename land in the browser's Downloads folder as `(1)`, `(2)`,
etc., which silently breaks the fixed `$zipPath` in the PowerShell template
above (it would point at a stale copy). Instead, suffix the filename with a
date/time stamp, e.g. `arp-next-20260922-1153.zip`, so each
delivery is unambiguous and the PowerShell snippet Claude sends always
references the file that was actually just downloaded.

The PowerShell template's `$zipPath` line should be updated to match the
exact filename delivered that turn, or use the "grab the newest zip"
approach below so the user doesn't have to edit it themselves:

```powershell
$zipPath = Get-ChildItem "D:\Chrome_Downloads\arp-next-*.zip" |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
```

## Domain conventions

- Roles are exactly four strings, case-sensitive in the DB, case-insensitive
  in comparisons (mirrors original PHP `strcasecmp`): `Admin`,
  `Secondary Admin`, `Reception`, `Technician`. Never invent a fifth role or
  rename these.
- Repair job `status` is one of exactly: `Received`, `Diagnosing`,
  `Repairing`, `Ready`, `Delivered` (DB CHECK constraint enforces this — do
  not add a status value without a matching migration).
- Existing user passwords are PHP bcrypt (`$2y$` prefix). Always go through
  `verifyPassword()` / `hashPassword()` in `src/lib/auth.ts` — never compare
  or hash passwords ad hoc elsewhere.
- Dates: DB stores `TIMESTAMP`/`DATE` with no timezone info (naive) except
  `login_attempts.locked_until` and `password_reset_tokens.expires_at`
  which are `TIMESTAMPTZ`. Preserve that distinction.

## Tech stack / architecture

- Framework: Next.js 14 (App Router), TypeScript, in `src/app/`
- Auth: signed JWT session cookie (`src/lib/auth.ts`), route protection in
  `src/middleware.ts`. Authenticated pages live under the `src/app/(app)/`
  route group, which shares the sidebar layout (`src/app/(app)/layout.tsx`).
- Data: PostgreSQL via Prisma (`prisma/schema.prisma`) — the **same**
  database the original PHP app (`Arp-main/`) used. No data migration.
  `Arp-main/database/schema.sql` is the canonical schema reference.
- Styling: Tailwind CSS. Shared component classes (`.card`, `.btn-primary`,
  `.input`) in `src/app/globals.css`.
- Nav: `src/lib/nav.ts` defines role-gated nav items — mirrors
  `Arp-main/includes/sidebar.php`'s visibility rules exactly. Any nav change
  must be checked against that file.
- Original app (`Arp-main/`) is the behavior reference only — do not run it,
  do not edit it, just read it before reimplementing a feature.
- Deployment target: **Render**, not Railway. Correction made 2026-09-25:
  `Arp-main/railway.json` exists, but `Arp-main/docker-entrypoint.sh` and
  `Arp-main/health.php` both explicitly reference "Render's free tier"
  spin-down behavior in their comments — the original app is actually
  deployed on Render (the `railway.json` looks like a leftover from an
  earlier or abandoned Railway attempt). This rewrite targets Render
  accordingly: native Node runtime via `render.yaml` (no Dockerfile needed
  — see that file's comment for why), plus a self-ping loop
  (`src/instrumentation.ts` + `GET /api/health`) ported from the
  original's `docker-entrypoint.sh` background loop, to stop the free
  tier's 15-minute idle spin-down. See commit-log session 14 for the full
  deploy steps.

## Things Claude should never do here

- Never commit secrets/API keys/`.env`.
- Never modify `Arp-main/` (the original PHP app) — it's the read-only
  behavior reference until the whole migration is done and the user
  decides to retire it.
- Never change `prisma/schema.prisma` in a way that isn't backward
  compatible with `Arp-main/database/schema.sql` without flagging it loudly
  — the same production database may still be read by the old app during
  the transition.
- Never re-hash or migrate existing users' passwords.
- Never silently drop a role-visibility rule when porting a page — check
  the equivalent original PHP file's role checks first.
