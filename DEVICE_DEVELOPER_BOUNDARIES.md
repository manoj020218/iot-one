# Device Developer Boundaries — Read Before You Write Any Code

You are building **one device's** firmware and/or plugin (backend +
frontend) inside the Jenix One monorepo. This file is the hard rulebook
for what you may edit. It exists because previous device work has, more
than once, edited shared platform files and broken other products that
were live at the time. That does not happen again starting with this
document.

If anything here seems to block you from doing your job, **stop and ask
the platform lead** — do not work around it by editing a file outside your
folder. Every capability a plugin needs from the platform is supposed to
be reachable without that.

For the *why* and the full architecture picture, read
[`PLATFORM_ARCHITECTURE_AND_ROLES.md`](./PLATFORM_ARCHITECTURE_AND_ROLES.md)
first. This file is the short, enforceable version of it.

---

## 1. Your folder

Everything you own lives under one path:

```
IOT_Device/<YourProduct>/
  <firmware source>              ← firmware developer
  VPS/  (or backend/)            ← plugin backend developer
  API_CONTRACT.md                ← your backend↔frontend contract, your responsibility to write
```

Plus, only if you are also doing frontend work, **one** of:

```
PWA_APK/apps/web-pwa/src/features/<yourproduct>/          ← simple feature folder
PWA_APK/apps/web-pwa/public/ui-packages/<yourpackage>/     ← dynamic UI package (see DEVICE_PACKAGE_RUNTIME.md)
```

You can create, delete, and restructure anything inside these paths
freely. Nobody else's product depends on your folder's internal
structure.

---

## 2. Files and folders you must NEVER edit

If your diff touches any of the following, it is a platform-core change —
send it to the platform lead as a proposal, do not merge it yourself:

- `VPS/apps/api-server/src/modules/**` — every existing device module
  (`devices`, `homes`, `auth`, `scenes`, `pid`, `ui-packages`, `ota`,
  `provisioning`, and every other product's module folder). This is
  shared or belongs to a different product.
- `VPS/apps/api-server/src/app.ts` — **except** the marked
  `PLUGIN MOUNT POINTS` block described in §3 below. Nothing else in this
  file.
- `VPS/apps/api-server/src/platform-api.ts` — you may *request* an export
  be added here, you do not add it yourself.
- `packages/shared/**`, `packages/device-schemas/**` — types every
  product depends on. A change here can silently break five other
  products' typecheck. Propose the change, don't merge it.
- `pnpm-workspace.yaml` — **except** adding your own package's path as a
  new line. Do not touch any existing line.
- `PWA_APK/apps/web-pwa/src/**` outside your own `features/<yourproduct>/`
  folder — in particular `app/`, `features/home/`, `features/devices/`,
  `features/auth/`, `features/scenes/` are shared shell code.
- Anything under `VPS/nginx/`, any `.env`/secrets file, any VPS deploy
  script, PM2 config, or the production server itself. You do not have —
  and should not need — VPS shell access to develop or test your plugin.
- Any other product's folder under `IOT_Device/`.

If you think you *need* to change one of these to do your job, that is a
platform-core capability gap, not something to patch around locally. Ask.

---

## 3. The one place you're allowed to touch `app.ts`

`app.ts` has a comment-marked block for exactly this purpose:

```ts
// ===== PLUGIN MOUNT POINTS — device plugin developers =====
// Add your product's router mount lines inside this block only, following
// the existing examples exactly. Do not add imports or app.use() calls
// anywhere else in this file. Ask the platform lead to review and merge
// this block — do not merge it yourself.
app.use(
  "/api/v1/streamer",
  requireAuthenticatedUser,
  createSmartStreamerRouter(platformApi)
);
// ===== END PLUGIN MOUNT POINTS =====
```

Your addition should look exactly like the `SmartStreamerRouter` or
`IpSpeakerRouter` lines already there — one import at the top, one or two
`app.use(...)` lines inside the block. If your change to this file is
bigger than that, you're doing something the pattern doesn't intend —
stop and ask.

---

## 4. The dependency rule: inject, never import

Your backend package must never write `import { ... } from
"../../api-server/src/modules/..."` or any relative path that reaches
outside your own folder into platform code. Instead:

1. Declare a TypeScript interface in your own `src/platform-deps.ts`
   listing exactly the platform functions you need (copy the shape of
   `IOT_Device/Smart Streamer/VPS/src/platform-deps.ts` — auth checks,
   device lookups, scene CRUD, whatever you actually use).
2. Your router factory function takes that interface as its only
   platform-facing argument: `createYourProductRouter(deps:
   YourProductPlatformDeps)`.
3. The platform lead wires the real implementations to your interface
   from `platform-api.ts` at the `app.ts` mount point (§3). You never see
   or import `api-server`'s real files — only the shape you declared.

If a function you need isn't already re-exported from `platform-api.ts`,
ask the platform lead to add it there. You do not add it yourself, and you
do not work around the gap by importing the module directly — that is
exactly the coupling this pattern exists to prevent.

---

## 5. What "done" looks like for a plugin backend

**Copy `IOT_Device/QRunlock/VPS/`** — it was built specifically as the
reference template (see its own `README.md`, "The method — copy this
shape"), smaller and more current than the two earlier examples
(`IOT_Device/Smart Streamer/VPS/`, `IOT_Device/Smart IP speaker/backend/`).
Whichever you start from, match this shape:

- Own `package.json` (`name: "@jenix/<yourproduct>-backend"`,
  `dependencies` limited to `@jenix/shared`, `@jenix/device-schemas`,
  `express`, and your own needs — nothing that reaches into `api-server`)
- `src/platform-deps.ts` — your declared contract (§4)
- `src/index.ts` — exports your router factory function(s)
- `API_CONTRACT.md` — every route you expose, request/response shapes,
  error codes, written for whoever builds the frontend against it (they
  may not be you)
- Tests (`vitest`) for anything with real logic — fanout, validation,
  conflict handling
- A short `HANDOFF.md` — what's done, what's verified, what's next — so
  the platform lead can review your work without re-deriving it from the
  diff

---

## 6. Firmware developer specifics

You never open `VPS/` or `PWA_APK/` at all. Your entire platform-facing
surface is documented in
[`DEVICE_INTEGRATION_GUIDE.md`](./DEVICE_INTEGRATION_GUIDE.md) and
[`PROVISIONING.md`](./PROVISIONING.md):

- the `pid` string the platform lead issues you before you write any
  cloud-facing code
- the provisioning handshake (BLE/SoftAP → Wi-Fi, per `PROVISIONING.md`)
- `POST /api/v1/devices/:deviceId/telemetry` with header `x-device-key`
- MQTT: subscribe `MQTT_DEVICE_COMMAND_TOPIC` / `MQTT_OTA_REQUEST_TOPIC`,
  publish the matching `..._ACK_TOPIC`

That is the complete list. If a feature you're building seems to need
anything else from the platform, it is very likely a plugin-backend
concern (§5), not a firmware concern — flag it rather than inventing a new
endpoint or protocol on the device side.

---

## 7. Before you open a PR — checklist

- [ ] Every file you changed is inside your product's folder, or is the
      marked `app.ts` block / a new `pnpm-workspace.yaml` line, added
      exactly as described above
- [ ] Your backend never imports `api-server` internals directly — only
      your own `platform-deps.ts` interface
- [ ] `pnpm --filter @jenix/<yourproduct>-backend typecheck` and `test`
      pass
- [ ] `pnpm --filter @jenix/api-server typecheck` and `test` still pass
      after your change (proves you didn't break the shell)
- [ ] `API_CONTRACT.md` (and `HANDOFF.md`) are written and current
- [ ] You have NOT touched: `.env`, secrets, nginx config, PM2 config, any
      VPS deploy script, or another product's folder

If every box is checked, send the diff to the platform lead. They will
apply the `app.ts` mount and the `platform-api.ts` export (if you needed a
new one) and merge.
