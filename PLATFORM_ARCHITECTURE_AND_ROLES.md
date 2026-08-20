# Jenix One — Platform Architecture and Roles

Audience: anyone deciding *who* builds *what* for a new or existing Jenix
device — the platform lead, a firmware engineer, or a device
backend/frontend ("plugin") engineer. Read this before writing any code.

This is the org chart translated into folders. It does not repeat the
technical contracts that already exist — it tells you which document to
read for which layer, and draws the line nobody is allowed to cross without
asking the platform lead first.

---

## 0. The model, in one sentence

Jenix One is a thin, shared shell (auth, homes, scenes, OTA, the PID
registry) that every device plugs into the same way Tuya Smart Life plugs
in a rice cooker or a door lock: the device brings its own icon, its own
control screens, and its own device-specific backend logic, but it never
forks or edits the shell itself.

Four layers, four different people can own them without ever touching each
other's files:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. FIRMWARE               owned by: firmware developer            │
│    Runs on the chip. Knows its PID, speaks provisioning + MQTT.   │
├─────────────────────────────────────────────────────────────────┤
│ 2. DEVICE PLUGIN — BACKEND owned by: device backend developer     │
│    IOT_Device/<Product>/VPS/  — its own package, own routes,      │
│    talks to the platform only through platform-deps.ts            │
├─────────────────────────────────────────────────────────────────┤
│ 3. DEVICE PLUGIN — FRONTEND owned by: device frontend developer   │
│    A dynamically-loaded UI package (device-specific screens),     │
│    OR a PWA feature folder for lighter integrations                │
├─────────────────────────────────────────────────────────────────┤
│ 0. PLATFORM CORE           owned by: platform lead (Manoj)        │
│    VPS/apps/api-server/src/{modules/devices,homes,auth,scenes,    │
│    pid,ui-packages,ota,provisioning}, packages/shared,             │
│    packages/device-schemas, app.ts, pnpm-workspace.yaml            │
└─────────────────────────────────────────────────────────────────┘
```

Layer 0 is the only layer that is shared, global, and blast-radius-large.
Layers 1–3 are per-device, isolated, and safe to hand to someone external.
[`DEVICE_DEVELOPER_BOUNDARIES.md`](./DEVICE_DEVELOPER_BOUNDARIES.md) is the
literal rulebook for layers 1–3 — hand that file, specifically, to any
device developer before they write a line of code.

---

## 1. The three roles

### Platform lead — you're reading this because you *are* this role

Owns layer 0 and is the only person who edits it. Responsibilities:

- Issue the PID for a new product (`POST /api/v1/admin/pids`) — see
  [`DEVICE_INTEGRATION_GUIDE.md`](./DEVICE_INTEGRATION_GUIDE.md) §"Required
  Product Metadata: PID". The PID carries the product's icon (`iconUrl`),
  category, and dashboard template — this is the "family ID" the device
  developer asked about. It exists before any device firmware ships.
- Review and merge the ~3-line integration point in `app.ts` a plugin
  backend needs (see §3 below) — the plugin developer proposes the diff,
  the platform lead applies/approves it, never the reverse.
- Decide what goes in `platform-api.ts` (the *only* surface plugin
  backends may depend on) — see §3.
- Own scenes, OTA, homes/sharing, auth, and MQTT runtime — every plugin
  reuses these, none of them re-implement their own.
- Keep [`DEVICE_INTEGRATION_GUIDE.md`](./DEVICE_INTEGRATION_GUIDE.md),
  [`DEVICE_PACKAGE_RUNTIME.md`](./DEVICE_PACKAGE_RUNTIME.md),
  [`PROVISIONING.md`](./PROVISIONING.md), and this document in sync with
  what the code actually does.

### Firmware developer

Owns `IOT_Device/<Product>/` firmware source only. Responsibilities and
constraints are fully specified in
[`PROVISIONING.md`](./PROVISIONING.md) (BLE/SoftAP security standard, every
device identical) and
[`DEVICE_INTEGRATION_GUIDE.md`](./DEVICE_INTEGRATION_GUIDE.md) (telemetry
shape, MQTT topics, registration payload, OTA ack contract). In short, the
firmware developer's entire platform-facing surface is:

- a `pid` string issued by the platform lead
- the provisioning handshake (BLE/SoftAP → Wi-Fi → platform claim call)
- `POST /devices/:deviceId/telemetry` with `x-device-key`
- subscribe `MQTT_DEVICE_COMMAND_TOPIC` / `MQTT_OTA_REQUEST_TOPIC`, publish
  the matching `*_ACK_TOPIC`

Nothing else. The firmware developer never opens `VPS/` or `PWA_APK/` at
all — see boundaries doc.

### Device plugin developer (backend + frontend)

Owns exactly one folder: `IOT_Device/<Product>/VPS/` (or `backend/` —
either name is used today, pick one per product) for backend, plus either
a dynamic UI package under `PWA_APK/apps/web-pwa/public/ui-packages/` or a
feature folder under `PWA_APK/apps/web-pwa/src/features/<product>/` for
frontend. This role is the one Tuya calls a "mini-program" developer: they
build the screens and business logic specific to one product, reusing
everything the shell already provides (auth, homes, scenes, OTA) through a
narrow, explicit interface. Full rules in
[`DEVICE_DEVELOPER_BOUNDARIES.md`](./DEVICE_DEVELOPER_BOUNDARIES.md).

---

## 2. Why a device gets an icon and shows up correctly — the PID

A device's PID record (issued once, by the platform lead, before any unit
ships) is the "family ID" mechanism the whole system hangs off:

```json
{
  "pid": "JNXQRU",
  "productName": "QRunlock Smart RF Door Lock",
  "productCategory": "Access Control",
  "iconUrl": "https://.../qrunlock/icon.png",
  "dashboard": { "templateId": "qrunlock-default", "icon": "lock" }
}
```

Provisioning only ever needs this one string (`pid`) plus the device's own
`deviceId` — see `DEVICE_INTEGRATION_GUIDE.md` §"BLE Discovery
Compatibility". The phone app looks up the PID, gets the icon and product
name back, and renders the "Add Device" card correctly without any
per-device code in the app. This is exactly the Tuya model: the app doesn't
need to know QRunlock exists at build time, it needs the PID to resolve.

---

## 3. Proof the plugin pattern already works — two shipped examples

Don't take this document's word for it — two products are already built
exactly this way and are live in the workspace:

| Product | Backend package | Contract doc |
|---|---|---|
| Smart Streamer | `IOT_Device/Smart Streamer/VPS/` → `@jenix/smart-streamer-backend` | `IOT_Device/Smart Streamer/VPS/API_CONTRACT.md` |
| Smart IP Speaker | `IOT_Device/Smart IP speaker/backend/` → `@jenix/ip-speaker-backend` | `IOT_Device/Smart IP speaker/backend/HANDOFF.md` |
| QRunlock (**the reference template — copy this one**) | `IOT_Device/QRunlock/VPS/` → `@jenix/qrunlock-backend` | `IOT_Device/QRunlock/VPS/API_CONTRACT.md` + `README.md` |

Both follow the identical shape:

1. **Own `package.json`**, registered as its own pnpm workspace member
   (see root `pnpm-workspace.yaml` — it lists the product's VPS folder
   directly, not a glob, so adding a new product is one explicit line the
   platform lead adds).
2. **Own `platform-deps.ts`** — a TypeScript interface declaring exactly
   the platform functions the plugin needs (e.g.
   `SmartStreamerPlatformDeps` in
   `IOT_Device/Smart Streamer/VPS/src/platform-deps.ts`). The plugin
   **never imports `api-server` files directly** — it receives these
   functions as constructor arguments.
3. **The platform side of that same contract** lives in exactly one file:
   [`VPS/apps/api-server/src/platform-api.ts`](./VPS/apps/api-server/src/platform-api.ts).
   Read its own header comment — it is deliberately tiny, a pure re-export
   list, "no new logic." If a plugin needs something not in that file, the
   plugin developer asks the platform lead to add the export; they do not
   reach into `modules/*` themselves.
4. **Own router factory** — `createSmartStreamerRouter(deps)` /
   `createIpSpeakerRouter(deps)` — exported from the package's `index.ts`.
5. **A three-line mount** in
   [`VPS/apps/api-server/src/app.ts`](./VPS/apps/api-server/src/app.ts):
   one import, one `app.use(...)` for the tenant-scoped router, one more
   for the device-action router. That is the entire footprint a plugin
   backend has inside the platform's own file. Everything else about the
   product lives in the plugin's own folder.
6. **Its own `API_CONTRACT.md` or `HANDOFF.md`** documenting exactly what
   the PWA/frontend calls, independent of the platform's internal shape —
   so the backend and frontend developer for that one product can work
   from that single document without reading `api-server` source at all.

`app.ts` now has a marked comment block around these mount lines (added by
this change) — that block is the *only* part of `app.ts` a plugin
developer's proposed diff should ever touch.

---

## 4. Two frontend integration options — pick the lighter one that fits

`DEVICE_PACKAGE_RUNTIME.md` documents the heavier option (a dynamically
loaded `remoteEntry.js` UI package, published to a separate `IOT_Devices`
repo, resolved per-PID at runtime — used today by Tank Guard). This is the
right choice when the product needs several custom screens and its own
release cadence independent of the main PWA build.

The lighter option — used by Smart Streamer (`PWA_APK/apps/web-pwa/src/
features/streamer/`) — is a normal feature folder built into the PWA. Pick
this when the product's screens are simple enough that bundling them with
the main app isn't a real cost yet. Either way, the frontend talks to the
backend plugin's own `API_CONTRACT.md` routes, never to `api-server`
internals directly, and never duplicates auth/session handling — it reuses
`app/authenticatedRequest.ts` exactly like every other feature.

---

## 5. Worked example — QRunlock as the pilot and reference template

QRunlock started as **firmware only** — no PID issued, no backend
package, no frontend feature — which made it the cleanest possible pilot
for this pattern end-to-end, the same way Token Dispenser was the pilot
for the provisioning standard (`PROVISIONING.md` §7).

What exists already:
- Firmware in `IOT_Device/QRunlock/src/` (`ProductIdentity.h` already
  declares `kPid = "JNX-QRU-C3-001"` and `kProvisioningNamePrefix =
  "JNXQRU"` — the firmware side of the identity is already in place)
- `IOT_Device/QRunlock/PROVISIONING.md` — the device-specific delta against
  the platform provisioning standard (§9 of that file), including the
  concrete list of firmware changes still needed to reach Security Scheme
  2
- **`IOT_Device/QRunlock/VPS/`** — the backend plugin package, now built
  and verified (`@jenix/qrunlock-backend`: devices, lock/unlock,
  RF-learn mode, relay-cooldown settings — see its own `HANDOFF.md` for
  exact status). This is deliberately **the reference template** going
  forward — smaller and more current than Smart Streamer's — so copy this
  one first when starting a new device's backend (see its `README.md`,
  "The method — copy this shape").

Steps to reach full parity with Smart Streamer / Smart IP Speaker (i.e.
live and reachable, not just built and tested):

1. **Platform lead**: issue the real PID via `POST /api/v1/admin/pids`
   (product name, icon, category, hardware profile), using
   `JNX-QRU-C3-001` as the `pid` value to match firmware and the backend
   package's `constants.ts`.
2. **Platform lead**: add the three-line mount in `app.ts`'s marked
   `PLUGIN MOUNT POINTS` blocks — `createQrunlockRouter` at
   `/api/v1/qrunlock`, `createQrunlockDeviceActionRouter` at
   `/api/v1/devices`.
3. **Firmware developer**: close the gap list in
   `IOT_Device/QRunlock/PROVISIONING.md` §9 (migrate to
   `wifi_provisioning`/`protocomm`, fix the naming convention, add the
   MQTT command/ack wiring the backend package's `unlock`/`rf-learning`
   actions currently only trigger without confirmation — see that
   package's `HANDOFF.md` "Known limits").
4. **Device plugin developer (frontend)**: a small
   `PWA_APK/apps/web-pwa/src/features/qrunlock/` feature folder (the
   lighter option from §4), built against
   `IOT_Device/QRunlock/VPS/API_CONTRACT.md`.
5. **Everyone**: run the validation script in
   `DEVICE_INTEGRATION_GUIDE.md` §"Minimal Validation Script For Every New
   Device" against a real unit.

This document does not build steps 1–5 — it defines who does each one and
in what order, so the platform lead can hand steps 3 and 4 to separate
people (or do them personally) without any of them needing write access to
platform core.

---

## 6. Document map

| Question | Read |
|---|---|
| "What may I touch and what happens if I don't follow this?" | [`DEVICE_DEVELOPER_BOUNDARIES.md`](./DEVICE_DEVELOPER_BOUNDARIES.md) |
| "How does my device register, send telemetry, receive scene/OTA commands?" | [`DEVICE_INTEGRATION_GUIDE.md`](./DEVICE_INTEGRATION_GUIDE.md) |
| "How do I build the BLE/SoftAP Wi-Fi handoff securely?" | [`PROVISIONING.md`](./PROVISIONING.md) |
| "How do device-specific frontend screens get loaded?" | [`DEVICE_PACKAGE_RUNTIME.md`](./DEVICE_PACKAGE_RUNTIME.md) |
| "Show me a finished example package to copy" | `IOT_Device/QRunlock/VPS/` (the reference template — start here) |
| "Who owns what, and who do I ask?" | this document |
