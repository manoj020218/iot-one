# QRunlock Backend — Handoff

## Date

August 20, 2026 (round 3 — vendor API for the QRunlock video-call product)
August 19, 2026 (round 2 — backend extended, frontend built, mounted live)

## Round 3 — vendor API, 2026-08-20

Builds the server-to-server link decided in
`IOT_Device/QRunlock/RELAY_INTEGRATION_PLAN.md`: the standalone QRunlock
video-call product (`qrunlock-api`, a separate live product) now reaches
this same PID's devices as a vendor of Jenix One, not through its own
device stack. Full detail lives in that plan doc; this is the
implementation summary.

**Renamed the PID** — `QRUNLOCK-PSU-RF` → **`JNX-QRU-C3-001`**. The old
value does not match the platform's own PID format rule
(`^JNX-[A-Z0-9]+(?:-[A-Z0-9]+)+$` in `pid.validation.ts`) and would have
been rejected the moment someone tried to actually issue it via
`POST /api/v1/admin/pids` — caught while writing an integration test for
this round, not before. Updated everywhere: `ProductIdentity.h`,
`constants.ts`, `qrunlockPid.ts` (PWA), every doc, every test. No device
has ever shipped with the old value (zero real users), so this was a free
fix — the exact kind of thing to catch before real deployment, not after.

**New on the Jenix side** (`VPS/apps/api-server/src/modules/api-access/`):
- `public-device-capabilities.ts` — a small registry letting a plugin
  (this one) claim its own PID's vendor-API behavior, so
  `executePublicDeviceCommand` routes a matching PID's commands through
  the plugin's own guarded service function instead of the generic
  scene-command dispatch. Populated from `app.ts` (the one place allowed
  to know about every mounted plugin), never imported by `api-access`
  itself — keeps the plugin/platform dependency direction correct.
- `POST /api/v1/public/devices/register` — vendor-authenticated (API key
  only, no Jenix user session) device claim into the key's own `homeId`
  — the "vendor pool HOME." Idempotent on re-registration; a 409 if the
  `deviceId` already belongs to a different HOME.
- `GET /api/v1/public/devices` — vendor device list, scoped to the key's
  HOME + PID.
- `GET`/`PATCH /api/v1/public/devices/:deviceId/config`,
  `GET .../logs` — routed through the registered plugin capability
  (QRunlock's own `getSettings`/`updateSettings`/`listActivity`).
- Removed a precondition in `createApiKey` that required a HOME to
  already contain a device of the target PID before a key could be
  issued — that's backwards for a vendor pool, where the key must exist
  *before* the first device is registered into it. Didn't gate anything
  security-relevant, only blocked the new flow's ordering.
- `app.ts` wires `unlockDevice`/`getSettings`/`updateSettings`/
  `listActivity` (all re-exported from `@jenix/qrunlock-backend`'s
  `index.ts` now) into the registry, passing a fixed `caller: "api:
  {packageId}"` — never client-supplied — through to the exact same
  guarded `unlockDevice()` the PWA itself calls. Verified, not assumed:
  an integration test drives a real unlock through the vendor route,
  then asserts a second immediate one gets the plugin's own
  `UNLOCK_COOLDOWN_ACTIVE`, then checks the activity log shows
  `source: "api:{packageId}"`.
- `api-access.controller.ts`'s `sendError` now also duck-types any
  thrown error carrying `statusCode`/`code` (i.e., any plugin's own
  error class) and surfaces it as-is, instead of flattening every
  non-`ApiAccessModuleError` into a generic 500 — this is what makes the
  cooldown error above actually visible to a vendor caller.

**On the QRunlock video-call product side**
(`D:\IOT Device\QRunlock\qrunlock`, a separate local project/repo):
- `backend/utils/smartRelay.js` — full rewrite to call Jenix's new
  vendor routes instead of the standalone Relay service
  (`RELAY_API_URL`). Every exported function signature is unchanged, so
  `backend/routes/smartRelay.js` — the per-user/per-family authorization
  layer (`Host.smartRelay.devices` ownership, `RelayInvite` sharing) —
  needed **zero changes**. See that project's own `HANDOFF.md` §0 for
  full detail, including what's verified vs. not (no live run of that
  app happened from here).
- `sendCommand` now only accepts `cmd: "inching"` (matches "QRunlock is
  inching-only" below) and no longer simulates a pulse client-side via
  on→sleep→off — Jenix's `unlock` command is atomic.
- `releaseDevice`/`registerFCM` are honest `501` stubs (no Jenix
  device-delete primitive; push notifications were out of scope).

**QRunlock is inching-only — confirmed 2026-08-20**: it's a RIM-lock
power supply (see `ProductIdentity.h`'s `kProductCategory`/
`kProductLine`, added this round), which only ever needs a momentary
release pulse. No on/off/toggle exists anywhere in the QRunlock command
surface, by design, not by omission.

**Guarded path, explicit caller — implemented 2026-08-20**:
`lock.service.ts`'s `unlockDevice()` takes an explicit `caller` parameter
set by the calling code (the PWA controller passes `"app"`, the vendor
route passes `"api:{packageId}"`), never by request body — a client
cannot claim to be someone else. The activity log's `source` field always
reflects the true caller.

**Verified this round**:
- `pnpm --filter @jenix/qrunlock-backend typecheck`/`test` — 21/21.
- `pnpm --filter @jenix/api-server typecheck`/`test` — **136/136**,
  including 8 new tests covering vendor registration, idempotency,
  cross-HOME conflict, HOME+PID-scoped listing, the guarded-unlock +
  cooldown path through the vendor route, and unsupported-command
  rejection.
- `pnpm --filter @jenix/web-pwa typecheck` — clean.
- `node --check` on the rewritten `smartRelay.js` — syntax valid; **not**
  run against a live server.

## Purpose of this package

The reference-template device plugin backend for Jenix One (see
`README.md` in this folder and `PLATFORM_ARCHITECTURE_AND_ROLES.md` at the
repo root). Built as the pilot for the "independent VPS backend per
device" pattern already proven by Smart Streamer and Smart IP Speaker —
QRunlock had zero platform-side integration before round 1, so it's the
cleanest example to copy for the next device. Round 2 took it from
"scaffolded but unmounted" to a real, live, end-to-end feature: mounted
into `app.ts`, and a full PWA screen built against it.

## Completed (round 1 + round 2)

- Self-contained backend package at `IOT_Device/QRunlock/VPS/` named
  `@jenix/qrunlock-backend`, exporting `createQrunlockRouter(deps)` and
  `createQrunlockDeviceActionRouter(deps)`.
- `devices` — tenant-scoped list/get, filtered to the `JNX-QRU-C3-001`
  PID, composing live state from every module below into one summary.
- `lock` — device-scoped `unlock` action mirroring
  `ControlApi::Unlock(reason)` in firmware, server-side cooldown
  enforcement, `requestId`-based idempotent retry, records an `unlock`
  activity event.
- `rf-learning` — device-scoped start/cancel plus a tenant-visible status
  read, mirroring `ControlApi::StartRfLearning()`/`CancelRfLearning()`,
  best-effort derived timeout, records `rf_learn_*` activity events.
- `rf-remotes` **(new, round 2)** — tenant-scoped named-remote list:
  add/rename/delete. Explicitly modeled as user bookkeeping, not a
  hardware-confirmed pairing registry (see its own doc comment in
  `rf-remote.service.ts` and API_CONTRACT.md §6) — there is still no
  firmware ack path telling the platform a pairing actually succeeded.
- `activity` **(new, round 2)** — tenant-scoped `GET .../activity`, a
  capped (50/device), newest-first in-memory feed that `lock` and
  `rf-learning` write into. No fabricated `auto_lock` event type — the
  10s auto-relock the PWA shows is a client-side display timer the
  backend never learns about (see `activity.types.ts`).
- `settings` — get/update for `relayCooldownMs` (bounds-checked),
  `relayPulseMs` (read-only, firmware-fixed), plus **two new fields**
  `relayStateAfterPowerRestore` and `switchType` **(round 2)** — accepted,
  validated, and persisted, but firmware has no config fields for either
  concept yet (see "Known limits").
- `pnpm-workspace.yaml` includes `IOT_Device/QRunlock/VPS`.
- **Mounted live in `app.ts`** (round 2) — both `createQrunlockRouter` and
  `createQrunlockDeviceActionRouter` are wired into the marked
  `PLUGIN MOUNT POINTS` blocks, and `@jenix/qrunlock-backend` is a real
  dependency of `@jenix/api-server`'s `package.json`. `/api/v1/qrunlock/*`
  and `/api/v1/devices/:id/qrunlock/*` are live routes as soon as the
  server runs — the only missing piece for a real device to actually
  appear is issuing the PID (see "Next recommended steps").
- **PWA feature built** (round 2) — see "Frontend state" below.
- `API_CONTRACT.md` updated with §5 Activity, §6 RF remotes, and the
  extended §4 Settings shape.

## Verified

- `pnpm --filter @jenix/qrunlock-backend typecheck` / `test` — 20/20 tests
  passed across `devices`, `lock`, `rf-learning`, `rf-remotes`,
  `activity`, `settings` — August 19, 2026.
- `pnpm --filter @jenix/api-server typecheck` / `test` — 131/131 tests
  passed with QRunlock mounted — proves the plugin didn't disturb the
  platform shell.
- `pnpm --filter @jenix/web-pwa typecheck` — clean across the new
  `features/qrunlock/` folder and the shared `DeviceTimerPanel`.
- `pnpm --filter @jenix/web-pwa test` — 52/52 existing tests still pass
  (in particular `AppBottomNav`-adjacent specs and
  `authenticatedRequest.spec.ts`, both touched by this change).
- **Not verified**: no live device, no running dev server, no browser
  click-through in this pass — see "Known limits" and "Next recommended
  steps". Typecheck/tests confirm correctness of the code, not that a
  real QRunlock unit actually behaves this way end-to-end yet.

## Backend state

- `src/constants.ts` — `QRUNLOCK_PID`, relay timing constants mirrored
  from firmware's `config/Defaults.h`.
- `src/platform-deps.ts` — injected contract: auth + device registry +
  command dispatch only.
- `src/devices/*`, `src/lock/*`, `src/rf-learning/*`, `src/settings/*` —
  as in round 1, `settings` now carrying the two extra fields.
- `src/rf-remotes/*`, `src/activity/*` — new in round 2.

## Frontend state

Built at `PWA_APK/apps/web-pwa/src/features/qrunlock/`:

- `qrunlockPid.ts` — PID constant, kept in sync by hand with firmware and
  the backend (same interim pattern as `smartStreamerPid.ts`).
- `services/qrunlockApi.ts` — full API client against every route in
  `API_CONTRACT.md`. Deliberately has **no demo/offline fallback store**
  (unlike `sceneApi.ts`/`deviceManagementApi.ts`) — QRunlock is new, not
  part of the legacy offline-first dashboard, so real errors surface
  rather than being masked by fabricated local state.
- `useHasQrunlockDevice.ts` — bottom-nav gating hook, same
  fail-closed/full-list-fetch interim approach as
  `useHasSmartStreamerDevice.ts`.
- `QrunlockRoute.tsx` — mounted at `/qrunlock/*` in `AppRouter.tsx`. Plain
  nested React Router tree (`/qrunlock` list, `/qrunlock/:deviceId`
  detail) — **not** routed through `RemoteProductMount`/the dynamic
  UI-package loader the way `/streamer/*` is. QRunlock's screens are
  simple enough to ship as an ordinary bundled feature (the "lighter
  option" from `PLATFORM_ARCHITECTURE_AND_ROLES.md` §4); building fake
  remote-package plumbing for it would have been unjustified complexity.
- `QrunlockDevicePage.tsx` — the device screen: header with rename, a
  **top segmented Lock/Timer/Settings control** (see "Design deviation
  from the approved mockup" below), Lock tab (padlock + activity
  preview), Timer tab, Settings tab, and two subscreens (full Activity
  Logs, RF Remote Setup) as internal view state.
- `components/LockHero.tsx` — the padlock control, wired to the real
  `unlock` endpoint. Catches `ApiResponseError` and checks `.code ===
  "UNLOCK_COOLDOWN_ACTIVE"` for a specific toast (this is what motivated
  extending `authenticatedRequest.ts`, see below). The 10s red→green ring
  is confirmed as a UI-only display timer, matching the backend's own
  documented honesty about not knowing when the relay physically resets.
- `components/ActivityFeed.tsx`, `RfRemoteSetupScreen.tsx`,
  `QrunlockSettingsPanel.tsx`, `RenameDeviceSheet.tsx`,
  `QrunlockInchingPanel.tsx` — wired to their respective real endpoints.
- `qrunlock.css` — structural styles reusing the app's real global tokens
  from `src/styles.css` (no new color/font system introduced).
- **Shared, reusable**: `features/devices/components/DeviceTimerPanel.tsx`
  + `deviceTimerPanel.css` — the 5-segment Countdown/Schedule/Circulate/
  Random/Inching shell, deliberately holding zero QRunlock-specific logic
  so a future device can reuse it with its own `panels` map. Only
  `inching` has real content today (`QrunlockInchingPanel`, read-only,
  showing the firmware-fixed 0.3s pulse); the other four modes render the
  shared `<ComingSoonPanel>` fallback rather than fabricated schedule
  persistence that doesn't exist server-side.
- **Platform-wide fix**: `app/authenticatedRequest.ts`'s
  `ApiResponseError` previously discarded the response body on every
  non-2xx response — no caller could ever read a backend's `error.code`.
  Extended it (additively — existing call sites unaffected, covered by
  the still-passing `authenticatedRequest.spec.ts`) to parse and attach
  `code`/`details`/`message` when present. This benefits every plugin's
  error codes going forward, not just QRunlock's.

## Design deviation from the approved mockup

The approved artifact mockup put Lock/Timer/Settings as a **second fixed
bottom tab bar**. The real app already renders a global fixed
`AppBottomNav` (Home/Devices/[+]/Streamer/Lock/Scenes/Settings) on every
authenticated page (`AuthenticatedAppFrame.tsx`) — stacking a second fixed
bottom bar under/over it would be a real UX regression the phone-frame
mockup couldn't have caught (it was built before the real router/nav was
investigated). Moved Lock/Timer/Settings to a **top segmented control**
instead, reusing the same `.jx-seg`-style visual language already used
elsewhere in the app (e.g. `HomeFilterTabs.tsx`). Worth showing the user
before considering this screen fully signed off.

## Decisions

- Kept persistence in-memory for every module (including the two new
  ones) — same "ship the contract first, swap storage later" choice as
  round 1, Smart Streamer, and Smart IP Speaker.
- `rf-remotes` "adding" a remote is user-confirmed bookkeeping, not a
  hardware-verified pairing — the frontend's RF setup screen asks the
  user to confirm ("I've paired it — Add") rather than faking an
  automatic success after a fixed delay, since there's genuinely no way
  for the platform to know.
- Did not build Countdown/Schedule/Circulate/Random scheduling logic —
  no backend concept exists for any of them (Smart Streamer's own
  schedule-to-Scenes pairing pattern would be the template if/when this
  is prioritized), so the frontend shows an honest "not available yet"
  panel instead of persisting fake schedule data.

## Known limits

- `rfLearnStatus` can never report `"learned"` — no MQTT ack from
  firmware confirming a pairing succeeded (PROVISIONING.md §9, item 9).
- `relayState` always reports `"idle"` — no real-time telemetry channel.
- `relayCooldownMs`, `relayStateAfterPowerRestore`, and `switchType`
  updates all dispatch a `sync_settings` MQTT command that firmware does
  not yet consume — persisted server-side, not live on the device.
  `relayStateAfterPowerRestore`/`switchType` additionally have **no
  firmware config fields at all** yet (`ConfigTypes.h` only has
  `relayPulseMs`/`relayCooldownMs`/OTA fields) — this is a firmware gap
  now formally tracked here, not previously called out in
  `PROVISIONING.md` §9.
- No live device, dev server, or browser testing performed this pass —
  see "Verified" above.

## Architecture question — resolved 2026-08-20

There is a second, already-live device cloud (`/root/projects/relay` on
the VPS) the QRunlock video-call app used to use — see "Round 3" above
and `RELAY_INTEGRATION_PLAN.md` for the full resolution: Jenix One stays
the single device platform, QRunlock (video-call) reaches it as a vendor.
That standalone service is left running, untouched, no migration
attempted (zero real users on it — nothing to migrate). No longer an open
question as of this round.

## Round 4 — vendor pool provisioned, live-verified, 2026-08-20

Steps 1–2 below (previously "Next recommended steps") are done:

- Real Jenix records exist: PID `JNX-QRU-C3-001` (`POST /api/v1/admin/pids`,
  required a `ui: { uiMode: "builtin" }` object the earlier example payload
  in this doc was missing — fixed), a dedicated vendor-pool HOME (account
  `qrunlock-vendor@jenix.internal`), `ApiPackage` `QRUNLOCK-VENDOR`, and a
  365-day `ApiKey` scoped to it. Created via `/root/bin/
  provision-qrunlock-vendor.sh` on the VPS (never prints the key/password —
  writes straight into QRunlock's `.env` and a root-only secrets file).
- The QRunlock video-call project's `.env` on the VPS
  (`/root/projects/qrunlock/qrunlock/.env`) has the real
  `JENIX_ONE_API_URL`/`JENIX_ONE_API_KEY` (renamed from `JENIX_API_*` —
  "JENIX" alone collided with another project's name); `qrunlock-api`
  restarted with them.
- **Live round-trip verified** with the real key (not just the automated
  test suite): `POST /api/v1/public/devices/register` → 201,
  `POST .../commands {command:"unlock"}` → 200 with `accepted: true` and a
  `cooldownMs`, `GET .../logs` → `source: "api:QRUNLOCK-VENDOR"`. Confirms
  the vendor path genuinely routes through Jenix's guarded `unlockDevice`
  service, not a stub. Test device `qrunlock-vendor-smoketest-01` was left
  in the vendor pool HOME (harmless, no dependents — delete whenever).
- Deploy scripts fixed at the script level (both flagged as fragile last
  round): QRunlock's `deploy.sh` step 4 now `cd backend` +
  `CI=true pnpm install --frozen-lockfile --prod --ignore-workspace`
  (was silently walking up into the shared `/root/projects/
  pnpm-workspace.yaml`); `/root/bin/deploy-iot-one.sh` now runs
  `pnpm -r --if-present build` + `pm2 restart --update-env` + a 10-attempt
  health-check loop after install (previously had none). Both exercised
  for real this round — QRunlock's full `deploy.sh` ran end to end
  (install succeeded against its own lockfile, PM2 restart clean, nginx
  reload clean, `https://qrunlock.com` and the API health endpoint both
  200 afterward).

## Round 5 — firmware MQTT bridge, 2026-08-20

User confirmed the flashed relay's local hardware path (Wi-Fi join +
`/api/relay/pulse`) works on real hardware. The remaining gap — firmware had
*no* cloud connectivity of any kind (verified by reading `platformio.ini`'s
`lib_deps` and `AppController.h`'s permanently-`false` `cloudConnected_`) —
is now closed: `src/cloud/CloudBridgeService.*` connects the device to
Jenix One's own canonical MQTT scheme, subscribes `cmd`, dispatches through
the exact same `ControlApi::Unlock()` every other input already uses, and
acks on `cmd/ack`. Built as an explicitly reusable pattern for future
devices — full protocol + reuse checklist in the new `BRIDGE.md`. Real
ESP32-C3 build verified (`pio run -e esp32-c3-supermini` — 75.4% flash,
16.1% RAM, links clean); native unit tests for the new pure logic
(`CloudBridgeLogic`'s topic building + command parsing) were written but
could not be executed on this machine (no gcc/g++ installed) — run
`pio test -e native` before trusting them blindly, though the real-target
build succeeding is strong secondary evidence the wiring compiles correctly.

**Still not live end-to-end**: the device needs `homeId` before it will
connect at all — see `BRIDGE.md` §4 for the local `POST /api/cloud` bench
mechanism (use `home-user-qrunlock-vendor-jenix-internal`, the real vendor
pool HOME from Round 3/4, for a first real test). Not yet flashed or tested
against a live broker as of this note — that's the next action.

## Next recommended steps

1. **Flash + test the bridge**: build/upload the updated firmware, join it
   to Wi-Fi, `POST /api/cloud` with the vendor pool `homeId` (see above),
   confirm `GET /api/status`'s `cloud.connected` flips true, then fire a
   real unlock through the vendor API smoke-tested in Round 4
   (`POST /api/v1/public/devices/<deviceId>/commands {"command":"unlock"}`)
   and confirm the physical relay actually pulses. This is the first
   genuinely real end-to-end test since this device was flashed.
2. **QRunlock video-call project**: actually run the app and click
   through the Relay device list/detail/unlock/settings pages against a
   real device — the vendor API itself is proven live, and now the
   device-side bridge is too, but the app's own UI against a real device
   is still unclicked. See that project's own `HANDOFF.md` §0
   "Not verified" list.
3. **Firmware**: decide whether `relayStateAfterPowerRestore`/`switchType`
   are worth adding to `ConfigTypes.h`, or should be dropped from the API
   instead of staying permanently inert.
4. Run the `DEVICE_INTEGRATION_GUIDE.md` §"Minimal Validation Script"
   end to end against a real unit, through **both** the PWA and the
   QRunlock vendor path — neither has happened yet.
5. Show the user the top-segmented-tabs deviation from the approved
   mockup (see above) before considering the PWA screen fully signed off.
6. Replace the bench-only `/api/cloud` binding mechanism with the real
   provisioning-intent bind flow (`PROVISIONING.md` §9 item 8) once that
   exists — not urgent while there's a single bench unit, load-bearing
   before any second device or a real customer.
