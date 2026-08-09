# Jenix One — Developer Handoff

> Read this first. `README.md` has the workspace layout and a dense
> changelog of runtime behavior (env vars, MQTT topic schemes, per-device
> quirks) — read that second, as reference, not front-to-back. This file
> is the orientation + "what's live, what's pending, what will bite you"
> summary, kept short on purpose.
> Last updated: 2026-08-09

---

## 1. What This Is

A PNPM monorepo for the Jenix One smart-home platform: a PWA (installable
as an Android APK shell), a Node/Express API server, and shared
PID-driven packages that let a new IoT product plug into scenes,
schedules, OTA, and Matter without touching shared code. See
`README.md` for the full workspace layout; the short version:

| Path | What |
|---|---|
| `PWA_APK/apps/web-pwa` | The PWA — dashboard, devices, scenes, settings, notifications |
| `PWA_APK/apps/android` | Capacitor Android shell around the same PWA |
| `VPS/apps/api-server` | Express API — auth, homes, devices, scenes, OTA, notifications, PID registry |
| `VPS/apps/admin-backend-ui` | Internal admin console (PID/OTA/UI-package management) |
| `packages/shared` | Cross-package types + utils — **must be rebuilt** after any source change, see §3 |
| `packages/device-schemas` | PID blueprint types (`CreatePidInput`, `PidAutomationProfile`, etc.) |
| `packages/ui` | Shared UI primitives (`AppShell`, etc.) |
| `IOT_Device/` | Firmware source trees, one folder per product — mostly untracked/pre-existing, not part of the pnpm workspace |

**Who should touch what, and how a new device plugs in:**
[PLATFORM_HANDOFF.md](./PLATFORM_HANDOFF.md) (ownership zones — what's
safe to self-serve vs. needs review) and
[DEVICE_INTEGRATION_GUIDE.md](./DEVICE_INTEGRATION_GUIDE.md) (the full
protocol contract: APIs, MQTT payloads, provisioning, OTA). For how a
device's commands become schedulable, see
[SCHEDULE.md](./SCHEDULE.md).

## 2. URLs

| URL | What |
|---|---|
| https://one.jenix.in/ | Marketing site (separate app, `Marekting/` — its own lockfile, not in the pnpm workspace) |
| https://one.jenix.in/app/ | The live PWA |
| https://one.jenix.in/api/v1/health | API health check |

## 3. The One Gotcha That Has Caused Two Production Incidents

`packages/shared` (and `device-schemas`, `ui`) ship **compiled `dist/`
output that is gitignored**. A fresh clone or a `rsync --delete` deploy
wipes it. `jenix-one-api` runs `tsx src/main.ts` directly and imports
`@jenix/shared` via its compiled `dist/index.js` — if that `dist/`
doesn't exist or is stale, the process crash-loops with
`ERR_MODULE_NOT_FOUND`. This has happened twice in production, both
self-inflicted by a "just deploy this one app" shortcut that skipped the
full workspace build.

**Rule, no exceptions: any deploy that runs `rsync --delete` must always
follow with `pnpm -r --if-present build` at the workspace root, even for
a change scoped to one app.** Cheap to over-apply, expensive to skip.

## 4. VPS Deploy — Working Sequence

Shared production box, **154.61.69.200**, PM2-managed, running ~20
unrelated projects for other clients on the same host. Be surgical —
only touch `jenix-one-api`'s PM2 process and the paths below; never
`pm2 restart`/`delete` anything else, and always check what a
port/service actually is before assuming it's yours.

```bash
# 1. Sync the git mirror
cd /root/repos/iot-one && git fetch --prune origin && git checkout main && git reset --hard origin/main

# 2. Rsync into the runtime dir (excludes keep .env, device-registry, etc. out of it)
rsync -a --delete --exclude=.git/ --exclude=node_modules/ --exclude=.env \
  --exclude=device-registry/ --exclude=jenix-one-deploy.tgz \
  /root/repos/iot-one/ /root/projects/IOT_one/

# 3. ALWAYS full workspace build (see §3) — builds shared/device-schemas/ui/api-server/web-pwa in one shot
cd /root/projects/IOT_one && pnpm -r --if-present build

# 4. Restart the API, then confirm
pm2 restart jenix-one-api
curl -sf http://127.0.0.1:4300/api/v1/health

# 5. Frontend static deploy
rsync -a --delete /root/projects/IOT_one/PWA_APK/apps/web-pwa/dist/ /var/www/one.jenix.in/app/
curl -sf https://one.jenix.in/app/
```

Marketing site (`Marekting/`) deploys separately — its own
`pnpm install && pnpm run build`, then `rsync -a --delete --exclude=app/`
into `/var/www/one.jenix.in/` (the `--exclude=app/` is mandatory, that
directory holds the live PWA on the same domain root).

**Before any deploy, take a backup** of whatever you're about to
overwrite (`cp -r` the static dir, or a source tarball) — this has saved
a rollback at least once already.

**PM2/nginx names that look like ours but aren't:** `jenix-backend` is a
different product ("jenixindia"), `jenix-api` is an unrelated school-bell
system, `backend.jenix.in` proxies to `jenix-backend` above, not us. Read
twice before restarting anything with "jenix" in the name.

**SSH quoting gotcha:** if using PuTTY's `plink.exe`/`pscp.exe` from
Windows, call them **directly**, not through a `.bat` wrapper — a `.bat`
routes through `cmd.exe`, which mangles `|`/`&&` inside the argument even
when quoted. For anything beyond a single pipe-free one-liner, write a
`.sh` file, `pscp` it over, then run it with one simple
`plink ... "bash /root/thefile.sh"` call.

## 5. Feature Status (as of 2026-08-09)

All of the below are **live and deployed**, most recent first:

- **Login security fix** (commit `958f8a5`) — `authApi.ts`'s
  login/signup/social-login used to swallow a real `401 Invalid
  credentials` and fabricate a fake local session instead, meaning any
  email/password combination got you into the app. Fixed by gating the
  demo-fallback on `shouldUseDemoFallback()`, same as every other module.
  **If you're adding a new "try real API, fall back to local demo"
  path anywhere, always gate it the same way — a bare `catch { return
  fabricatedFallback() }` with no status check is the exact shape of
  this bug.** See `app/authenticatedRequest.ts` for the canonical guard.
- **PID-declared schedule commands** (commit `f96c696`) — each device
  type now declares its own `automation.commands` on its PID blueprint
  (`packages/device-schemas/src/pid/pid.types.ts`) instead of every
  device sharing one hand-maintained, previously-stale command list. The
  Scene builder's command picker resolves per-device now. See
  `SCHEDULE.md`.
- **Notification Center, Phase 1** (commit `890d60c`) — in-app only (no
  push yet). Bell + unread count on the dashboard, fed by scene
  "notification" actions and HOME membership events (join/leave/role
  change/remove). See `VPS/apps/api-server/src/modules/notifications/`.
  **Circular-import gotcha if you touch this:** `createNotification()`
  lives in its own file, `notification.write.ts`, separate from
  `notification.service.ts` — the service file needs
  `resolveHomeAccessContext` from `home.service.ts`, and `home.service.ts`
  needs to call `createNotification`, so putting both in one file would
  cycle. Import `createNotification` from `notification.write.ts` only.
- **SmartLife-style Scenes + Home/Member Management redesign** (commit
  `8b93e44`) — Tap-to-Run vs. Automation split with a chip-based IF/THEN
  editor; Home Management → Home Detail → Members drill-down. Added
  previously-missing scene delete and leave-home capabilities.
- **Marketing site redesign** — glassmorphism "Ink Continuity" visual
  identity, separate from the app's own light theme. Root site is a
  standalone project, `Marekting/`, not part of the pnpm workspace.

## 6. Known Open Items

- **Uncommitted, not mine, unclear if finished:** the working tree has
  pre-existing uncommitted changes wiring a `@jenix/smart-streamer-backend`
  workspace package into `VPS/apps/api-server/src/app.ts` (new routes
  under `/api/v1/devices` and `/api/v1/streamer`), plus a new
  `IOT_Device/Smart Streamer/VPS` workspace member in
  `pnpm-workspace.yaml`, and an untracked `platform-api.ts`. **Do not
  assume this is done or safe to commit as-is** — verify it builds,
  typechecks, and has tests before shipping it. (Also uncommitted:
  `PROVISIONING.md` has local edits.)
- **Notification Center Phase 2/3** — device-offline/OTA-available as
  real stored events, and real push delivery (Web Push/VAPID). Phase 1
  is poll-based in-app only.
- **Matter runtime** — commissioning/bridge-sync are still placeholder
  flows (validate PID/permissions, no live commissioner transport).
  Stays behind `MATTER_RUNTIME_ENABLED=false` until vendor ID + CSA
  readiness work is done.
- **Licensed MQTT / third-party device access** — architecture is
  planned (`MQTT_LICENSED_DEVICE_ACCESS_PLAN.md`) but the per-device
  credential + signed license manifest + broker ACL phases aren't built.
- **Provisioning** — the PWA-side BLE/AP flow is real and works; per
  PROVISIONING.md's own fleet table, most firmware sides are still
  "pending" (no `wifi_prov_mgr_*`/`protocomm_*` calls yet, Tank Guard is
  the designated pilot).

## 7. VPS Incidents Worth Knowing About (all resolved)

- **apache2 vs nginx port race on reboot** — both were enabled to
  auto-start; apache2 won the race for 80/443 on one reboot, taking down
  every nginx site. apache2's own vhosts didn't even resolve to this
  server anymore (confirmed via DNS). Fixed by disabling apache2
  entirely; it should stay disabled.
- **gzip compression was effectively off platform-wide** — `gzip on;`
  was set in the global nginx config but `gzip_proxied` (which defaults
  to *off* and blocks compression on anything behind `proxy_pass` — i.e.
  almost every app on this box) was never set. Fixed once, globally, in
  `/etc/nginx/nginx.conf`'s `http {}` block — not a per-site config
  issue.
- **SSL auto-renewal** — the `certbot.timer` was already running; the
  actual problem was a stray non-UTF-8 byte in one unrelated site's
  nginx config breaking certbot's parser for every renewal batch, plus a
  couple of sites missing a proper `.well-known/acme-challenge` location
  block. Both classes of bug are worth checking if a renewal silently
  fails again.

## 8. Commands

```bash
cmd /c pnpm install   # PowerShell can block the pnpm.ps1 shim on this machine
cmd /c pnpm lint
cmd /c pnpm typecheck
cmd /c pnpm test
cmd /c pnpm build     # always run at the workspace root, not per-app — see §3
```
