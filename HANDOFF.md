# Jenix One — Developer Handoff

> Read this first. `README.md` has the workspace layout and a dense
> changelog of runtime behavior (env vars, MQTT topic schemes, per-device
> quirks) — read that second, as reference, not front-to-back. This file
> is the orientation + "what's live, what's pending, what will bite you"
> summary, kept short on purpose.
> Last updated: 2026-09-01

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
[SCHEDULE.md](./SCHEDULE.md). For how a device's own UI gets loaded
dynamically instead of shipping inside the base app bundle, see
[DEVICE_PACKAGE_RUNTIME.md](./DEVICE_PACKAGE_RUNTIME.md) — `qrunlock-mobile`
is the reference package (real TSX + a Vite build pipeline, not
hand-authored JS) to copy for a new full-routed device app.

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

### Three separate git repos are involved here, not one

This has caused real confusion (2026-09-01) and is worth internalizing
before touching deploy at all:

1. **`manoj020218/iot-one`** — this monorepo. Local dev clones this;
   the VPS keeps its own clone at `/root/repos/iot-one` purely as a
   fetch/reset staging area, never edited in place.
2. **`manoj020218/IOT_Devices`** — a *completely separate* repo holding
   per-device release artifacts: firmware binaries, PID capability
   manifests, and **built UI-package bundles** (the actual
   `remoteEntry.js` a dynamic device page runs — see
   `DEVICE_PACKAGE_RUNTIME.md`). Cloned on the VPS at
   `/root/repos/IOT_Devices`. **A device's dynamic-remote-package
   source lives in `iot-one` (`PWA_APK/apps/web-pwa/src/features/
   <device>/remotePackage/`), but the *built* bundle that production
   actually serves has to be separately committed and pushed to
   *this* repo — building it in `iot-one` alone changes nothing live.**
   Confirmed 2026-09-01: `token-dispenser-mobile`'s deployed bundle had
   sat as a stale placeholder (wrong `exportName`, wrong `templateId`,
   missing its CSS entirely — compare a working manifest like
   `qrunlock-mobile`'s to sanity-check a new one) since whenever it was
   first drafted, silently never able to mount, because nobody pushed
   a real build here after `iot-one`'s source was finished.
3. **`/root/projects/IOT_one`** — **not a git repo.** Pure `rsync`
   target (step 2 below), gitignored `.git` excluded. This is what
   `pm2` actually runs `jenix-one-api` from. `device-registry/` inside
   it is excluded from that rsync and instead populated straight from
   repo #2 by `sync-device-registry.sh` (called automatically as the
   last step of `deploy-iot-one.sh`).

**The recurring gotcha:** `deploy-iot-one.sh`'s `BRANCH` defaults to
`main` and every step below resets hard to `origin/$BRANCH` —
regardless of what branch you've actually been pushing feature work to
(e.g. `codex/smart-speaker-20260813`). Active development can sit on a
feature branch for an entire session, get pushed and typechecked
repeatedly, and still never reach production until that branch is
fast-forwarded into `main` and pushed there too. **Before assuming a
deploy will pick up recent work, confirm
`git rev-list --count origin/main..origin/<your-branch>` is `0`** — if
it isn't, fast-forward first: `git push origin <your-branch>:main`
(direct pushes to `main` are typically blocked for the assistant by
Claude Code's auto-mode classifier; the user runs this one via `!`).

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

`deploy-iot-one.sh` automates steps 1–4 (and the device-registry sync,
§5) but **not** step 5 above — the frontend rsync to `/var/www/` is
still a separate manual command after it finishes.

**Publishing a new/updated dynamic-remote-package build** (see the
three-repos note above) is a separate push entirely, into
`manoj020218/IOT_Devices`, not `iot-one`:

```bash
# From wherever you built it, e.g. PWA_APK/apps/web-pwa/public/ui-packages/<pkg>/<ver>/
git clone https://github.com/manoj020218/IOT_Devices.git   # or reuse an existing clone
cp <built files> IOT_Devices/devices/<PID>/ui-packages/<pkg>/<ver>/
cd IOT_Devices && git add -A && git commit -m "..." && git push origin main
# Then, on the VPS:
bash /root/bin/sync-device-registry.sh main
```
Sanity-check a new manifest.json against an already-working device's
(e.g. `qrunlock-mobile`'s) before pushing — `exportName` must match
what the package's own `register.ts` actually exports, and
`templateId`/`capabilities` should follow the same shape other working
packages use, not be invented fresh.

## 5. Adding a New Device — Minimum Code Edits

Full detail: [PLATFORM_HANDOFF.md](./PLATFORM_HANDOFF.md) (ownership
zones) and [DEVICE_INTEGRATION_GUIDE.md](./DEVICE_INTEGRATION_GUIDE.md)
(the protocol contract). This is the short version so a new device
doesn't turn into edits to shared platform code — **a device is a
plugin, never a fork.**

Note for whoever is building the device: this is usually **one person
doing firmware, UI/UX, and the VPS backend module together**, not a
handoff between three specialists. All three rows in the table below are
typically all yours — the split is by *area of the codebase*, not by
who's doing it.

Everything below except the "Zone 2" list is a **new folder/file you own
outright** — no existing file is touched:

| What | Where | Zone |
|---|---|---|
| Backend endpoints (if you need more than generic telemetry/register/command) | new folder `VPS/apps/api-server/src/modules/<your-device>/` | 1 — yours |
| Device UI (if the generic telemetry dashboard isn't enough) | new folder `PWA_APK/apps/web-pwa/src/features/<your-device>/`, built as a **remote package** (see below) | 1 — yours |
| Firmware | your own firmware repo, not this monorepo | 1 — yours |

**Building the UI as a remote package** (don't ship it inside the base
app bundle): follow `features/qrunlock/remotePackage/` as the template —
real `.tsx`, a `register.ts` that calls `host.registerPackage(...)`, and
a `vite.config.ts` built on the shared factory
`platform/remotePackageBuild/createRemotePackageConfig.ts`. Building it
(`pnpm --filter @jenix/web-pwa build:<your-package>`) outputs a
self-contained `remoteEntry.js` under `public/ui-packages/<your-plugin>/`
that loads on demand — see
[DEVICE_PACKAGE_RUNTIME.md](./DEVICE_PACKAGE_RUNTIME.md).

**The only touches to shared files** (each is a small, additive
line/entry referencing only your own PID — never an edit to existing
device behavior):

1. Register your PID — one new exported constant in
   `packages/device-schemas/src/pid/pid.types.ts` (copy an existing
   blueprint's shape), or `POST /api/v1/admin/pids`.
2. One new tile in `features/devices/deviceCatalog.ts`.
3. One new route line in `PWA_APK/apps/web-pwa/src/app/AppRouter.tsx`.
4. One new ownership-gated bottom-nav entry, following
   `features/qrunlock/useHasQrunlockDevice.ts`.
5. If you're publishing a package artifact: your own PID folder under
   the separate `IOT_Devices` repo
   (`devices/<PID>/ui-packages/<package>/<version>/`), then
   `sync-device-registry.sh`.

If a task seems to require editing `AppRouter.tsx` beyond one line,
`AppBottomNav.tsx`, `DeviceDetailPage.tsx`'s shared rendering logic, the
scene engine, or the `auth`/`homes`/`notifications` core modules —
that's Zone 3 in PLATFORM_HANDOFF.md: stop, it needs the platform
maintainer, not a workaround inside your own module.

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

## 5. Feature Status (as of 2026-09-01)

All of the below are **live and deployed** unless noted otherwise, most recent first:

- **Token Dispenser (`JNX-TD-C3-01`) brought to QRunlock parity, real
  hardware onboarded end-to-end** (commits `9402dda`, `7e5a0c6`, `6851ad4`
  on `codex/smart-speaker-20260813`) — VPS now speaks the canonical
  `jnx/{tenantId}/{pid}/{deviceId}/{suffix}` scheme for this device
  (previously the firmware side was done but the VPS half never was);
  periodic snapshot moved from `.../telemetry` (reserved internally for
  cross-instance scene-job relay) to `.../status`; real local API token
  added matching QRunlock's pattern; the PWA-tool React files were built
  into a proper `token-dispenser-mobile` dynamic remote package (see
  `DEVICE_PACKAGE_RUNTIME.md`) instead of a webui fallback. Home-page
  compact tiles are now a PID-keyed component registry
  (`HomeDeviceSection.tsx`'s `COMPACT_TILE_COMPONENTS`) so every device's
  tile is added the same way at the same size.
  - **Root-caused and fixed a real "device shows online forever" bug,
    confirmed to also explain why QRunlock devices weren't flipping
    offline either:** `ensureDeviceId()` in the firmware's
    `config_store.cpp` built its internal deviceId as
    `JNX-{full 6-byte MAC}`, but the app derives
    `JNX-TD-C3-{last-3-MAC-bytes}` from the BLE-advertised name
    (`bleDiscoveryService.ts`'s `deriveDeviceIdFromPid`) and registers
    *that* string in Mongo. Every topic the firmware published to
    (`status`/`lwt`/`events`/`cmd`) therefore targeted a deviceId the
    backend never saw — confirmed live by finding retained
    `{"status":"offline"}` LWT messages on the broker for QRunlock
    deviceIds (proving the LWT subscription/handler mechanism itself
    works) but zero retained message at all under Token Dispenser's old
    deviceId. Fixed to match QRunlock's own `DeviceIdentity.cpp` pattern.
    **If you ever see a device stuck at one MQTT status forever, check
    this class of bug first** — compare what the firmware actually
    publishes on the wire against what deviceId string the app
    registered, don't assume the LWT/backend plumbing is broken.
    **Existing flashed units need a full erase before reflashing** — the
    wrong deviceId is already burned into NVS, so a normal upload alone
    won't regenerate it.
  - **New: BLE provisioning auto-fills the Security Scheme 2 pairing
    code (PoP) instead of asking the installer to type it in.** The
    Flash Tool already captures each device's real PoP at factory-flash
    time; it's now also POSTed to a new
    `VPS/apps/api-server/src/modules/factory-records` module (Mongo-backed,
    admin-key-gated ingest, session-authenticated read by deviceId) and
    the app looks it up when a device is selected in
    `BleProvisioningPage.tsx`, same auto-fill-unless-touched pattern as
    Wi-Fi SSID detection. Falls back to manual entry when there's no
    factory record (e.g. units flashed before this feature) — nothing
    regresses. Wire-up for a new/re-flashed unit needs
    `<PREFIX>_ADMIN_API_URL` set wherever `flash_tool.py` runs (see its
    own `--help`); without it, flashing still works, the app just falls
    back to the manual field.
  - **Follow-up fix (commit `d6c5c5e`):** the first version of this only
    *prefilled* the pairing-code field, it never stopped rendering it —
    so the installer still saw (and could still edit) a field that was
    supposed to be invisible on a successful auto-fill. Fixed to
    replace the field with a confirmation line once a factory-record
    PoP is found; the input only ever appears as the genuine fallback
    (no record / lookup still in flight).
  - **Separately found while testing this: `token-dispenser-mobile`'s
    deployed UI-package bundle (in the separate `IOT_Devices` repo, see
    §4) was a stale placeholder** — wrong `exportName`
    (`TokenDispenserDynamicPage` vs. the real `TokenDispenserApp`),
    wrong `templateId`/`capabilities` shape, and missing its built CSS
    entirely. It could never have mounted correctly in production,
    independent of anything else in this session. Rebuilt and pushed
    the real bundle to `IOT_Devices` (commit `d05ffb7` there).
  - **Also found and fixed a genuine deploy-topology gap**, not specific
    to this device: `deploy-iot-one.sh` only ever deploys `iot-one`'s
    `main` branch, so this entire session's work (43 commits, including
    everything above) sat unshipped on `codex/smart-speaker-20260813`
    the whole time — restarting `jenix-one-api` after building from the
    feature branch's own checkout looked like a successful deploy but
    changed nothing live, since `pm2` runs from a separate rsync target
    (`/root/projects/IOT_one`) that only ever gets refreshed from
    `main`. Fixed for now by fast-forwarding `main` to the branch tip;
    see §4's new "three separate git repos" note for the permanent fix
    (always check `git rev-list --count origin/main..origin/<branch>`
    before assuming a deploy did anything).
- **Android app ready for its first Play Store release** (commits
  `2956431`, `7d6a79f`, `02f38ac`, `6193d24` on `codex/smart-speaker-20260813`)
  — **not yet uploaded, blocked on Play Console account verification**
  (see §6). Everything on the app side is done and verified on real
  hardware:
  - Replaced the stock `cap add android` placeholder icon/splash with a
    real identity (geometric "J" + accent-node mark, reusing the web
    app's own `--ink`/`--success` tokens from `styles.css`) sized to
    Play Store's adaptive-icon spec. `PWA_APK/apps/android/resources/`
    holds the master art if it ever needs regenerating via
    `npx @capacitor/assets generate --android` — but see the next bullet
    before trusting that tool's output blindly.
  - **Gotcha if you ever regenerate icons with `@capacitor/assets`:** it
    emitted the adaptive-icon foreground/background layers at the
    legacy 48dp-icon grid (max 192px) instead of the correct 108dp
    adaptive grid (max 432px). The launcher icon looked fine at that
    size; the Android 12+ splash renders the same drawable much larger
    and it was visibly blurry. If you regenerate, verify
    `mipmap-xxxhdpi/ic_launcher_foreground.png` is 432×432, not 192×192.
  - Wired the real Android 12 Splash Screen API
    (`windowSplashScreenBackground`/`windowSplashScreenAnimatedIcon` in
    `styles.xml`, `SplashScreen.installSplashScreen(this)` in
    `MainActivity.java`) instead of relying only on the old
    window-background-drawable trick.
  - Fixed a white flash between the splash and real content — two
    separate causes, both needed fixing: (1) the SplashScreen API's
    `postSplashScreenTheme` swapped to a theme with
    `android:background="@null"`, and (2) independently of the theme,
    Capacitor's WebView paints its own default-white surface the
    instant it attaches, before the page/CSS has loaded, regardless of
    the window background. Fixed by keeping `@drawable/splash` as the
    post-splash theme's background too, **and** explicitly setting
    `getBridge().getWebView().setBackgroundColor(...)` in
    `MainActivity.onCreate()`.
  - `values/colors.xml` didn't exist — `colorPrimary`/`colorPrimaryDark`/
    `colorAccent` were referenced in `styles.xml` but silently resolved
    through some dependency AAR's default. Added the file with the real
    brand colors.
  - **Release signing set up** (first-ever release, fresh keystore
    generated): see `PWA_APK/apps/android/RELEASE_SIGNING.md` for the
    keystore's real location (outside this repo, on the dev machine —
    **not backed up anywhere else yet**, treat that as the actual
    remaining risk here) and how to rebuild `assembleRelease
    bundleRelease`.
  - Native Google Sign-In's release SHA-1 is registered in the Google
    Cloud OAuth client and confirmed working on the signed release
    build. (If it ever throws Play Services status code `12502`
    `SIGN_IN_CURRENTLY_IN_PROGRESS` during testing, that's stuck
    client-side flow state from rapid reinstalls, not a config problem —
    force-stop and relaunch.)
  - Auth page's login card shrunk ~20% and given a more visible
    border-radius (`PWA_APK/apps/web-pwa/src/styles.css`'s
    `.auth-card`) — at its old `max-width: 380px` it filled the phone
    viewport edge-to-edge and the existing 24px radius barely read as
    rounded.
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

- **Play Store upload — waiting on account verification, not a code
  blocker.** The signed `.aab`/`.apk` are built and verified (see §5
  above and `RELEASE_SIGNING.md`); the Play Console developer account
  itself is still going through Google's verification process. Once
  that clears, rebuild fresh (`gradlew assembleRelease bundleRelease`
  from `PWA_APK/apps/android/android`, keystore is already wired up)
  rather than uploading a build that's been sitting around, then upload
  `app/build/outputs/bundle/release/app-release.aab` — Play Console's
  production track wants the App Bundle, not the APK.
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
