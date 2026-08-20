# QRunlock VPS Package — Reference Template

This folder is the canonical example of a Jenix One device plugin backend.
**If you are building the backend for a new device, copy this folder's
structure, not Smart Streamer's or Smart IP Speaker's** — this one is
smaller, more recent, and was written specifically to be the template. The
rules below apply to any device, not just QRunlock.

If you haven't already, read
[`DEVICE_DEVELOPER_BOUNDARIES.md`](../../../DEVICE_DEVELOPER_BOUNDARIES.md)
at the repo root first — that's the hard rulebook this package is a
worked example of.

---

## What "done" means, and what you hand back

A finished device plugin backend is **one self-contained folder** —
exactly this one — that:

- has its own `package.json` (`@jenix/<yourdevice>-backend`)
- typechecks and tests green **on its own**, without anyone else's help:
  ```
  pnpm --filter @jenix/<yourdevice>-backend typecheck
  pnpm --filter @jenix/<yourdevice>-backend test
  ```
- never imports platform (`api-server`) files directly — only its own
  `src/platform-deps.ts` contract (see below)
- ships its own `API_CONTRACT.md` (routes, request/response shapes, error
  codes) so a frontend developer can build against it without reading your
  source
- ships its own `HANDOFF.md` (what's done, what's verified, what's next)
  so the platform lead can review and wire it in without re-deriving your
  work from the diff

That folder is what you hand back. You do **not** need to touch `app.ts`
or wire yourself into the platform to be "done" — that's the platform
lead's step, done from your `HANDOFF.md` and `index.ts` exports, once your
folder is reviewed. (This particular package's `pnpm-workspace.yaml`
line was added by the platform lead to build/verify it end-to-end while
scaffolding the template — see that file's own note. Your own package
gets the same one-line addition, and nothing else, at review time.)

---

## The method — copy this shape

```
IOT_Device/<YourDevice>/VPS/
  package.json              <- name: "@jenix/<yourdevice>-backend"
  tsconfig.json              <- copy verbatim, same relative depth
  README.md                  <- this file, adapted to your device
  API_CONTRACT.md            <- your routes, for whoever builds frontend
  HANDOFF.md                 <- status: done / verified / next steps
  src/
    constants.ts              <- your PID string + any firmware-mirrored constants
    platform-deps.ts           <- the ONLY platform contract you depend on
    index.ts                   <- exports createXRouter() / createXDeviceActionRouter()
    devices/                   <- list/get, filtered to your PID (every device needs this)
    <your-device-specific-modules>/   <- one folder per genuinely device-specific action
```

Each device-specific module (like this package's `lock/`, `rf-learning/`,
`settings/`) follows the same five-file split every existing module in
this repo uses — copy `lock/` as the template for a device-scoped action,
`settings/` for a tenant-scoped resource with validation:

```
<module>/
  <module>.types.ts        <- summary/input shapes + a <Module>Error class
  <module>.model.ts         <- in-memory repository (swap for real persistence later)
  <module>.service.ts       <- business logic, calls deps.dispatchDeviceUiCommand
  <module>.controller.ts    <- Express handlers, catches <Module>Error -> HTTP status
  <module>.routes.ts        <- router factory, mounted by index.ts
  <module>.validation.ts    <- only if the route accepts a body to parse
  <module>.test.ts          <- vitest, for anything with real logic (conflicts, idempotency)
```

**Only build a module for something the device genuinely does that plain
telemetry + the platform's generic scene commands (`refresh`, `sync`,
`set_relay`, `notify`, `factory_reset`, `ota_force` — see
`DEVICE_INTEGRATION_GUIDE.md`) can't already express.** QRunlock's
`unlock` (momentary relay pulse with a cooldown business rule) and
`rf-learning` (start/cancel a stateful pairing mode) are genuinely
device-specific — a plain sensor reporting a number is not, and shouldn't
get a plugin backend at all.

---

## The one rule that matters most: inject, never import

Look at `src/platform-deps.ts` — it declares exactly the platform
functions this package uses (`requireAuthenticatedUser`, `listDevices`,
`getDevice`, `dispatchDeviceUiCommand`) as a plain TypeScript interface.
Every service function in this package takes that interface as its first
argument. Nothing in `src/` ever writes `import ... from
"../../../VPS/apps/api-server/..."` or any path that reaches outside this
folder into platform code.

The platform lead wires the real implementations to that interface (from
`VPS/apps/api-server/src/platform-api.ts`) at the `app.ts` mount point —
you never see or need api-server's actual source to build or test this
package. If you need a platform capability this package's
`platform-deps.ts` doesn't declare yet, that's a request to the platform
lead, not something to work around.

---

## What this package intentionally does NOT do

- No MQTT client, no direct device connection — every command goes
  through `deps.dispatchDeviceUiCommand`, which is the platform's existing
  MQTT dispatch, not something this package reimplements.
- No OTA logic — OTA is fully generic
  (`/api/v1/admin/ota`, `DEVICE_INTEGRATION_GUIDE.md` §OTA) and this
  package doesn't touch it.
- No real persistence yet — every `*.model.ts` here is an in-memory `Map`,
  matching the same "ship the contract first, swap storage later" choice
  Smart Streamer and Smart IP Speaker made (see their own `HANDOFF.md`s).
  Swapping to MongoDB later should only touch the `.model.ts` files.
