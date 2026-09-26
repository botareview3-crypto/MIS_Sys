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
  project owner. GitHub repo (the one Render actually deploys from):
  https://github.com/botareview3-crypto/MIS_Sys, remote name `botareview`.
  `origin` also points at this same repo now, but pushing `origin` has
  failed with a 403 (credential mismatch) — always push the `botareview`
  remote explicitly, which has working embedded credentials. The original
  `zementaye/MIS_Sys` repo is no longer the deploy source; don't push there
  expecting it to reach production.

Template to reuse (update `$zipPath` if the filename changes):

```powershell
# --- Paths ---
$zipPath    = "D:\Chrome_Downloads\arp-next-updated.zip"
$extractTo  = "D:\Chrome_Downloads\arp-next-updated"
$repoPath   = "D:\Chrome_Downloads\MIS_Sys"

# --- 1. Unzip the download (into its own temp folder first) ---
Expand-Archive -Path $zipPath -DestinationPath $extractTo -Force

# --- 2. Remove files/folders this delivery deleted (only present when
# Claude's reply says files were removed this session; empty/omit
# otherwise — see "Handling deleted files" below) ---
$toRemove = @(
    # "path\to\removed\file.ts",
    # "path\to\removed\folder"
)
foreach ($path in $toRemove) {
    $fullPath = Join-Path $repoPath $path
    if (Test-Path $fullPath) {
        Remove-Item -Path $fullPath -Recurse -Force
        Write-Host "Removed: $fullPath"
    }
}

# --- 3. Copy the extracted files into the git repo, overwriting existing ones ---
Copy-Item -Path "$extractTo\*" -Destination $repoPath -Recurse -Force

# --- 4. Clean up the temp extraction folder ---
Remove-Item -Path $extractTo -Recurse -Force

# --- 5. Stage, commit, and push ---
cd $repoPath
git status
git add -A
git commit -m "Describe the change here"
git push botareview main   # or master - check with: git branch --show-current
# (push botareview, not origin - origin's push has 403'd before; botareview
# has working embedded credentials and is what Render actually deploys from)
```

Notes for Claude to keep in mind:
- Check the actual downloaded filename in `<DOWNLOADS_FOLDER>` before assuming
  it matches `$zipPath` exactly (browsers append ` (1)`, etc. on repeat
  downloads).
- Never assume the default branch name — tell the user to confirm with
  `git branch --show-current` before pushing.

### Handling deleted files

`Copy-Item -Force` overwrites files but never deletes ones that exist in the
repo but not in the new zip — first hit 2026-09-26 (session 25) when the
WhatsApp auto-send removal left stale files behind. Whenever Claude's own
changes this session delete a file or folder from the project (not just
edit it), Claude must populate the `$toRemove` array in step 2 above with
every such path (Windows-style backslashes, relative to `$repoPath`) —
don't leave it commented out/empty in that case. When nothing was deleted
this session, leave `$toRemove` empty and say so briefly, so the user
knows step 2 is a no-op rather than wondering if something was missed.

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
