# New Product Launch SOP — Jenix One Platform

Single checklist for taking any new device/product from "firmware exists" to
"fully live on the One platform." QRunlock, Token Dispenser, and School Bell
have each independently hit the same gap this SOP exists to stop a fourth
product from repeating: nothing documented the Home-tile/dynamic-package
steps as required, so each one shipped without them and had to be fixed
after the fact.

For the deeper "why" behind any step here, see:
- `DEVICE_INTEGRATION_GUIDE.md` — PID/telemetry/auth/provisioning contract
- `DEVICE_PACKAGE_RUNTIME.md` — how the remote UI package runtime works
- `PROVISIONING.md` — BLE/AP provisioning wire protocol

## Definition of done — read this before touching anything else

**Provisioning is not complete just because:**
- BLE/AP pairing succeeded
- Wi-Fi joined
- the device was registered in the backend (`POST /api/v1/devices/register` returned 200)
- the Home page shows the device as "Live" / online

**Provisioning is only complete when:**
1. The device's Home tile renders using **its own** Remote UI Package tile — not the generic fallback tile.
2. Tapping that tile launches **its own** remote package UI — not the generic admin device page.

**Why this is the actual gate, not a cosmetic nice-to-have:** a tile showing
fabricated data (e.g. a Tank Guard water-level gauge on a bell) or a tap that
opens the generic `/devices/:deviceId` admin page instead of the product's
own app are both *silent* failures — nothing errors, nothing crashes, the
device still shows "Live." They are also the **only externally observable
proof** that the whole chain actually works end to end: PID registration →
package catalog binding → remote entry fetch → mount. If the tile doesn't
show the product's own tile, or the tap doesn't launch the product's own
package, treat the launch as **failed**, no matter what every earlier step
reported.

## Checklist

### 1. Platform metadata (backend)
- [ ] Register the PID via `POST /api/v1/admin/pids` using the blueprint already committed in `packages/device-schemas/src/pid/pid.types.ts` (`allPidBlueprints`).
- [ ] Confirm `GET /api/v1/pids/:pid` returns **200** on the live VPS before moving on. A missing PID here doesn't fail loudly later — it fails as a masked, silent "Success" screen on the phone (see the School Bell PID-not-found incident, 2026-09-19).

### 2. UI package
- [ ] Choose a package shape: **per-device dynamic page** (one embedded card, e.g. Tank Guard) vs **full routed product package** (a whole mounted sub-app with its own navigation, e.g. QRunlock, Token Dispenser, School Bell). See `DEVICE_PACKAGE_RUNTIME.md`'s "Two ways to build a package."
- [ ] Build and publish the remote package artifact to `IOT_Devices` and the VPS `device-registry`.
- [ ] Set `ui.uiMode`, `ui.uiPackageId`, `ui.uiPackageVersion` on the PID blueprint.

### 3. Home tile — required, not optional
- [ ] Add `<Product>HomeTile.tsx` under `PWA_APK/apps/web-pwa/src/features/home/components/` — copy `TokenDispenserHomeTile.tsx` or `SchoolBellHomeTile.tsx` as the template (same `qr-home-*` CSS classes, same compact-card footprint).
- [ ] Register it in `HomeDeviceSection.tsx`'s `COMPACT_TILE_COMPONENTS` map, keyed by the product's own PID constant.
- [ ] **Do not skip this.** Any PID missing from that map silently falls through to `DeviceTile.tsx`, which is hardcoded to Tank Guard's tank/flow/pump shape and will render fabricated tank-gauge/litre/flow data for a product that has none of it. This exact bug hit QRunlock, Token Dispenser, and School Bell, independently, before each was pulled out of it one at a time.

### 4. Tap-to-open routing — required for a full routed product package
- [ ] If the product is a full routed product package (its own `/<product>/*` route, e.g. `/qrunlock/*`, `/token-dispenser/*`, `/school-bell/*`), add a branch for its PID in `HomeDashboardPage.tsx`'s `openDevice()` function, routing to that path — same pattern as the existing QRunlock/Token Dispenser/School Bell branches.
- [ ] Skipping this means tapping the tile falls back to the generic `/devices/:deviceId` admin page (firmware/matter/rollout panels) instead of the product's own control app — the exact bug School Bell hit (2026-09-20).
- [ ] Per-device dynamic-page products (Tank Guard, SOS Siren, P10 Display, Smart RF Transmitter, Nurse Call Receiver) do **not** need this branch — they're meant to use the generic `/devices/:deviceId` route, which mounts their page via `PidDynamicPageRenderer`.

### 5. Provisioning flow
- [ ] Confirm the app's provisioning flow actually calls `POST /api/v1/devices/register` with the correct `pid`, and that a real backend error surfaces to the UI instead of being swallowed into a fake local "Success" (see the fix in `provisioningApi.ts`, 2026-09-19 — this only protects you if the code path actually reaches a real error; it doesn't replace checking step 1).

### 6. End-to-end verification — the actual sign-off gate
Do this against a real device, a real phone, and a real account — never a
demo/local-fallback session, since that can mask every failure mode above:
- [ ] Provision the device fully (BLE/AP pairing → Wi-Fi join → registration).
- [ ] Open the Home page. Confirm the tile shows the product's **own** icon/shape (step 3) — not a generic tank gauge.
- [ ] Tap the tile. Confirm it opens the product's **own** remote package UI (step 4) — not the generic admin device page.
- [ ] Only once both are visually confirmed is the platform launch for this product actually complete.

## History
- 2026-09-20: written after School Bell independently reproduced the same
  "generic tank tile + no dynamic launch" gap QRunlock and Token Dispenser
  had already been fixed for — nothing had documented it as a required step
  for a new product, so it kept recurring one product at a time.
