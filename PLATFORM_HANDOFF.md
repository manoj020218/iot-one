# Platform Handoff — Who Owns What

Audience: firmware developers, IoT device UI developers, and IoT device
backend developers bringing a **new product** onto Jenix One (or extending
an existing one). This is not a protocol reference — see
[DEVICE_INTEGRATION_GUIDE.md](./DEVICE_INTEGRATION_GUIDE.md) for the APIs
and MQTT payload shapes, and [SCHEDULE.md](./SCHEDULE.md) for how a
device's commands plug into scenes/automation. This document answers a
different question: **which files am I allowed to touch, and which ones
do I leave alone?**

## The golden rule

Your device is a plugin into a generic platform, not a fork of it. If you
find yourself editing a file that isn't inside your own device's module
or plugin folder, stop and check the zones below first — there is almost
always an additive, your-device-only way to do what you need instead.

Unreviewed edits to shared engine code are how both of this platform's
real production incidents happened (a workspace build step skipped on a
"just one app" deploy, and a port conflict from an unrelated service) —
neither was a device integration, but the lesson generalizes: the smaller
and more additive a change to shared code is, the safer this shared,
always-live production box stays for every product on it, including
yours.

---

## Zone 1 — Your own territory: edit freely, no review needed

- **Firmware developer:** your firmware repo, entirely. Nothing in this
  monorepo is yours to edit directly — if you need a new command name or
  MQTT contract, that's a request to the backend developer (Zone 3 below
  covers what happens on their side).
- **Backend developer:** a new folder,
  `VPS/apps/api-server/src/modules/<your-device>/`, following the
  standard module shape (`*.types.ts`, `*.model.ts`, `*.service.ts`,
  `*.controller.ts`, `*.routes.ts`, `*.test.ts` — Tank Guard's siblings
  like `sos-siren/`, `token-dispenser/`, `p10-display/` are all templates
  to copy from). Everything inside this folder is yours.
- **UI developer:** a new remote UI package — a feature folder (e.g.
  `features/qrunlock/`) with its screens as real `.tsx`, plus a
  `remotePackage/` subfolder holding the entry component, a
  `register.ts`, and a `vite.config.ts` built on the shared factory
  `platform/remotePackageBuild/createRemotePackageConfig.ts`. Building it
  (`pnpm --filter @jenix/web-pwa build:<your-package>`) produces a
  self-registering `remoteEntry.js` under
  `PWA_APK/apps/web-pwa/public/ui-packages/<your-device>-plugin/`. Set
  your PID's `ui.uiMode: "remote-package"` and it mounts generically
  through `RemoteProductMount.tsx` — the platform never needs to know
  your plugin's internals. `features/qrunlock/remotePackage/` is the
  current reference example (real TSX compiled by a real build, not
  hand-authored `React.createElement()` calls — see
  [DEVICE_PACKAGE_RUNTIME.md](./DEVICE_PACKAGE_RUNTIME.md)'s "Two ways to
  build a package") and needs **zero edits** to any shared page.

If your device's dashboard need is simple (a tank-style gauge, a signal
bar, a sparkline), you may not need a plugin at all —
`features/home/telemetry/deviceTelemetry.ts` already renders any device
from its telemetry shape with no per-device code. Check
DEVICE_INTEGRATION_GUIDE.md's "Dashboard UI integration" section before
building a plugin for something this generic dashboard already covers.

---

## Zone 2 — Small, additive touches to shared files: pre-approved, no review needed

This is the explicit "minor changes" carve-out — safe because each item
is an **addition that only affects your own product**, never an edit to
existing shared behavior:

1. **Register your PID.** Either `POST /api/v1/admin/pids`, or add one
   new exported `CreatePidInput` constant to
   `packages/device-schemas/src/pid/pid.types.ts` (copy the shape of
   `foundationPidBlueprint` or `smartStreamerPidBlueprint` exactly).
   Never edit another product's existing PID blueprint.
2. **Your PID's icon/art** — `iconUrl`, `imageUrl`, `dashboard.icon`, or
   adding the actual icon asset file.
3. **Your device's catalog tile** — one new entry in
   `PWA_APK/apps/web-pwa/src/features/devices/deviceCatalog.ts`.
4. **Your device's card(s) at the Device page** — via your PID's
   `dashboard.templateId` / `dashboard.dynamicPages` plus your own plugin
   (Zone 1). Don't add per-product branches inside the shared
   `DeviceDetailPage.tsx` rendering logic itself for anything beyond a
   simple, single `pid ===` check next to the existing tank-gauge
   fallback (`DeviceTile.tsx`) — if it's more than a one-line check and a
   new small component, it belongs in a Zone 1 plugin instead.
5. **Your PID's `automation.commands`** (see SCHEDULE.md) — as long as
   every command you list already exists in the shared
   `SceneActionCommand` union. If you need a genuinely new command name,
   *that specific addition* is Zone 3; declaring it on your own PID once
   it exists is Zone 2.
6. **One new route line** for your own pages in
   `PWA_APK/apps/web-pwa/src/app/AppRouter.tsx`, and **one new mount
   line** for your own router in
   `VPS/apps/api-server/src/app.ts`. Additive only — don't reorder or
   restructure the existing table.
7. **One new ownership-gated bottom-nav entry**, following the pattern in
   `features/streamer/useHasSmartStreamerDevice.ts` (hide the nav item
   unless the current HOME actually owns your PID). Additive only.

**Rule of thumb:** if your diff to a shared file is "I added N lines that
only reference my own PID/product," it's Zone 2. If it changes behavior
for *existing* devices, or restructures shared logic to fit yours, it's
Zone 3.

---

## Zone 3 — Needs the platform maintainer: open a PR, don't deploy solo

- New entries in `packages/shared/src/types/scene.ts`'s
  `SceneActionCommand` union, and the paired `allSceneActionCommands` /
  `describeSceneActionCommand` in `packages/shared/src/utils/scene.ts` —
  this is shared vocabulary every device's automation picker and the
  backend's validator both read from.
- Any change to the scene engine itself: `scene.service.ts`,
  `scene.action-worker.ts`, `scene.scheduler.ts`, `scene.validation.ts`,
  `scene.runtime-worker.ts`.
- Any change to the `auth`, `homes`, or `notifications` core modules
  (`auth.service.ts`, `home.service.ts`, `notification.service.ts`,
  `notification.write.ts`) — these enforce access control for every
  product; a mistake here is a security bug platform-wide, not a
  per-device bug.
- Any change to shared middleware: `request-auth.ts`,
  `require-admin.ts`, `require-device-auth.ts`.
- Any change to `AppShell.tsx`, the design tokens at the top of
  `styles.css` (the `:root` variables), or restructuring
  `AppBottomNav.tsx` / `AppRouter.tsx` beyond adding your own line.
- Any edit inside `packages/shared` or `packages/device-schemas` that
  changes an *existing* type's required fields, renames something, or
  removes something — additive-only new types/fields are fine (Zone 2),
  breaking edits are not.
- Anything touching VPS deploy scripts, nginx config, PM2 process
  definitions, or the shared MQTT topic names/env vars in
  `runtime.types.ts`.

If you're not sure whether your change needs a `SceneActionCommand`
addition or an existing one already covers it, check
`allSceneActionCommands` in `packages/shared/src/utils/scene.ts` first —
reusing an existing command name across products is preferred to adding a
near-duplicate.

---

## Zone 4 — Not yours: don't touch

- Another device's module folder, PID blueprint, or UI plugin.
- Any other app in the monorepo you don't own.

---

## Quick reference by role

| Role | Lives mostly in (Zone 1) | May also touch (Zone 2) | Needs a PR for (Zone 3) |
|---|---|---|---|
| Firmware developer | own firmware repo | — | requesting a new command name (routed through the backend developer) |
| IoT device UI developer | `public/ui-packages/<mine>/`, `features/<mine>/` | `deviceCatalog.ts` entry, one `AppRouter.tsx` route, one bottom-nav entry, PID icon fields | any shared page/component edit outside your plugin, `styles.css` tokens |
| IoT device backend developer | `modules/<mine>/` | PID blueprint + `automation.commands`, one `app.ts` mount line, `main.ts` persistence wiring | scene engine, auth/homes/notifications core, shared middleware |

---

## Adding a brand-new device — abbreviated checklist

Full protocol detail is in DEVICE_INTEGRATION_GUIDE.md; this is just the
"which zone is each step in" summary:

1. Register the PID (Zone 2) — see DEVICE_INTEGRATION_GUIDE.md's PID
   example for the required shape.
2. Declare `automation.commands` if the device should be schedulable
   (Zone 2, or Zone 3 first if a command name is genuinely new) — see
   SCHEDULE.md.
3. Build your backend module if you need endpoints beyond generic
   telemetry/register/command (Zone 1).
4. Build your UI plugin if the generic telemetry-driven dashboard isn't
   enough (Zone 1).
5. Add your catalog tile, icon, nav entry, and one route line (Zone 2).
6. Firmware: implement provisioning, telemetry, and MQTT command/ack per
   DEVICE_INTEGRATION_GUIDE.md (Zone 1, firmware repo).
7. Run the existing test suites (`pnpm -r --if-present build`, then each
   app's own test script) before asking anyone to review — a clean
   Zone 1/2 diff should never break an existing test, since nothing
   shared changed behavior.

---

## Documents this one assumes you'll also read

- [DEVICE_INTEGRATION_GUIDE.md](./DEVICE_INTEGRATION_GUIDE.md) — the
  technical contract: APIs, MQTT payloads, telemetry, provisioning, OTA.
- [SCHEDULE.md](./SCHEDULE.md) — how a device's commands become available
  to the platform's schedule/automation system.
- [SMART_STREAMER_PLATFORM_ADDITIONS.md](./SMART_STREAMER_PLATFORM_ADDITIONS.md) —
  a worked example of the right response when a device genuinely needs
  something the platform doesn't have yet: write up the gap and its
  blast radius, don't quietly hack around it inside your own module.
