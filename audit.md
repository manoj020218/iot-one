# Jenix One — IoT Platform Technical Audit

**Scope:** Full audit of the Jenix One monorepo — `VPS/apps/api-server` (Express + MongoDB + MQTT backend), `VPS/apps/admin-backend-ui` (developer/admin console — device "PID" product management, OTA, firmware, matter mapping), `PWA_APK/apps/web-pwa` + `android` (end-user PWA), and `packages/*` (device-schemas, shared, ui). Devices like **Tank Guard** report telemetry (`tankLevelMm`, `signalStrength`) over MQTT/HTTP.
**Objective:** Identify bugs, crashes, "code that's there but doesn't work," and every plausible failure at the UI/UX, API, device, MQTT, and VPS levels — with professional corrective actions.
**Date:** 2026-07-08
**Auditor:** Automated code review (Claude)

> **Overall:** This is a **well-architected, modern codebase** — domain-driven module structure, TypeScript throughout, Zod-validated env, per-module routers, a test suite, and a clean separation of api-server / admin-ui / PWA / shared packages. It is clearly mid-build (the log shows "phase 18"). The critical issue is that the **entire admin/OTA/device-product surface is currently mounted with no authentication** — almost certainly because auth hasn't been wired to those routers yet, but as it stands it's an open door on the most dangerous endpoints in an IoT platform (firmware publishing). Fix that and this is a strong foundation.

---

## Severity summary

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 2 | Unauthenticated admin/OTA firmware publishing + device-product management; unauthenticated telemetry ingest (device spoofing) |
| 🟠 High | 4 | No security middleware (helmet/CORS/rate-limit), frontend-only "RequireDeveloper" gate, no MQTT device-identity/ACL enforcement, no crash net |
| 🟡 Medium | 4 | OTA release integrity (signing), public PID exposure, no request validation depth on ingest, single API instance + MQTT state |
| ⚪ Low / hygiene | 3 | Committed deploy tarball + temp logs, error-handling consistency, PWA demo store left in |

---

## 🔴 Critical findings

### SEC-01 — The entire `/api/v1/admin/*` surface has no authentication (including OTA firmware publishing)
**Evidence:** `VPS/apps/api-server/src/app.ts` mounts the admin routers **without** `requireAuthenticatedUser`:
```ts
app.use("/api/v1/admin/api-packages", adminApiPackageRouter);
app.use("/api/v1/admin/ota", otaRouter);
app.use("/api/v1/admin/pids", pidRouter);
```
And the routers themselves apply **no middleware** — e.g. `modules/ota/ota.routes.ts` is just:
```ts
otaRouter.post("/releases", createOtaReleaseController);   // publish OTA firmware release
otaRouter.get("/releases", listOtaReleasesController);
```
`modules/pid/pid.routes.ts` similarly exposes `POST /`, `PATCH /:pid`, `POST /:pid/approve`, `POST /:pid/archive` with no auth. (By contrast, `homes`, `api-keys`, `matter`, `provisioning`, `scenes` **are** correctly wrapped with `requireAuthenticatedUser`.)
**Impact:** Anyone who can reach the API can:
- **Publish OTA firmware releases** (`POST /api/v1/admin/ota/releases`). If devices pull and apply these, this is **remote code execution across the entire device fleet** — the worst-case outcome for an IoT platform (bricked or backdoored Tank Guard units in the field).
- **Create, modify, approve, and archive device product definitions (PIDs)** — firmware families, hardware maps, Matter mappings, dashboard templates — corrupting the product catalog that provisions every device.
- **Manage API packages** — the monetization/access layer.

The admin **UI** has a `RequireDeveloper` gate (`admin-backend-ui/src/app/RequireDeveloper.tsx`), but that's client-side only — the **server does not enforce it**, so the gate is cosmetic.
**Corrective action:** Wrap every admin router in server-side auth **and** an authorization check (developer/admin role): `app.use("/api/v1/admin/ota", requireAuthenticatedUser, requireDeveloperRole, otaRouter)` — same for `pids` and `api-packages`. Treat this as the #1 fix. Add a test that asserts each admin route returns 401/403 without a valid developer token.

### SEC-02 — Telemetry ingest is unauthenticated (device spoofing / data injection)
**Evidence:** `modules/devices/device.routes.ts`:
```ts
deviceRouter.post("/:deviceId/telemetry", ingestDeviceTelemetryController); // ← before auth
deviceRouter.use(requireAuthenticatedUser);                                 // ← applied after
```
The telemetry endpoint is registered **before** the auth middleware, so it runs unauthenticated. (This is deliberate — field devices can't present a user JWT — but it means there's no user auth *and* it needs device-level auth instead.)
**Impact:** Anyone can `POST /api/v1/devices/<anyDeviceId>/telemetry` with arbitrary values — inject fake tank levels, spoof a device being online, or flood the ingest path. For a monitoring platform, forged telemetry undermines the core product (false readings, false/missed alerts) and enables DoS.
**Corrective action:** Authenticate the device itself — a per-device token / HMAC-signed payload / mTLS — verified in `ingestDeviceTelemetryController` before accepting data. Rate-limit per device. Reject telemetry for unknown/unclaimed device IDs.

---

## 🟠 High findings

### SEC-03 — No security middleware (no helmet, no CORS policy, no rate limiting)
**Evidence:** `app.ts` sets `app.disable("x-powered-by")` and `express.json()` only — no `helmet()`, no `cors()` config, no rate limiter.
**Impact:** Missing standard hardening headers; CORS is unconfigured (browser behavior undefined / potentially permissive depending on proxy); and no throttling on auth, telemetry, or admin endpoints — brute force and DoS are unmitigated (compounding SEC-01/SEC-02).
**Corrective action:** Add `helmet()`, an explicit CORS allow-list, and `express-rate-limit` (global + stricter on `/auth` and `/devices/:id/telemetry`).

### SEC-04 — Authorization is enforced in the UI but not the API
**Evidence:** `admin-backend-ui` has `RequireDeveloper.tsx` / `DeveloperSessionProvider.tsx`; the PWA has `RequireAuth.tsx`. But the admin API routers (SEC-01) enforce nothing server-side.
**Impact:** Any client-side gate is bypassable (call the API directly). Security that lives only in the frontend is not security.
**Corrective action:** Mirror every UI gate with a server-side role/permission check. Add a shared `requireRole()` middleware and apply it consistently.

### MQTT-01 — No device-identity or topic-ACL enforcement in the MQTT runtime
**Evidence:** `infrastructure/mqtt/*` connects with a single broker `username`/`password` from env; topics are shared (`jenix/runtime/telemetry`, `.../commands`, `.../ota`). No per-device credentials or topic ACLs are evident.
**Impact:** If devices share broker credentials (or the broker lacks ACLs), any device (or anyone with the shared creds) can publish to command/OTA topics and control **other** devices, or subscribe to others' telemetry. For physical IoT (valves, pumps behind Tank Guard), that's a real safety/security concern.
**Corrective action:** Per-device MQTT credentials + broker ACLs restricting each device to its own topic namespace; sign commands; verify device identity on the runtime bridge.

### STAB-01 — No process-level crash handling
**Evidence:** No `process.on('uncaughtException')` / `unhandledRejection` handlers in `main.ts`; the MQTT runtime bridge and workers run in-process.
**Impact:** An unhandled rejection in an MQTT handler, worker, or ingest path crashes the API — telemetry stops flowing and the fleet goes dark until restart.
**Corrective action:** Add top-level crash handlers (log + graceful exit for the process manager); wrap MQTT/worker callbacks in try/catch with reconnection/backoff.

---

## 🟡 Medium findings

- **OTA-01 — Firmware release integrity:** beyond auth (SEC-01), OTA releases should be **signed** and devices should verify the signature before applying, so a compromised API or CDN can't push tampered firmware. Confirm the release model stores a hash/signature and the device verifies it.
- **PID-01 — Public PID endpoint exposure:** `/api/v1/pids/:pid` (`publicPidRouter`) is intentionally public; confirm it exposes only what a provisioning device needs (no firmware URLs/secrets/internal fields).
- **VAL-01 — Ingest validation depth:** ensure `ingestDeviceTelemetryController` validates against the device's PID telemetry schema (`packages/device-schemas`) — types, ranges (`min`/`max`), and unknown keys — so malformed/oversized payloads can't corrupt state or storage.
- **SCALE-01 — Single API instance holds MQTT/runtime state:** like most of the sibling projects, horizontal scaling needs the MQTT runtime and any in-memory runtime state externalized (or a documented single-instance constraint).

## ⚪ Low / hygiene

- **HYG-01 — Build/temp artifacts in the tree:** `jenix-one-deploy.tgz` (543 KB), `tmp-api-err.log`, `tmp-api-out.log` sit at the repo root. Keep deploy bundles and logs out of git; add to `.gitignore`.
- **HYG-02 — PWA demo store:** `dashboard/services/deviceDemoStore.ts` — ensure demo/mock data can't leak into production builds (feature-flag or strip it).
- **HYG-03 — Consistent error handling & structured logging:** confirm a central Express error handler + structured logs with request/device IDs (important for diagnosing device fleet issues).

---

## Priority remediation plan

**This week (close the open doors):**
1. `SEC-01` Add `requireAuthenticatedUser` + `requireDeveloperRole` to `admin/ota`, `admin/pids`, `admin/api-packages`; add tests asserting 401/403.
2. `SEC-02` Device-level auth (token/HMAC) on telemetry ingest; reject unknown devices; rate-limit.
3. `SEC-03` helmet + CORS allow-list + rate limiting.

**This month (device trust + resilience):**
4. `SEC-04` Server-side role checks mirroring every UI gate.
5. `MQTT-01` Per-device MQTT creds + topic ACLs; sign device commands.
6. `OTA-01` Sign firmware releases; device-side signature verification.
7. `STAB-01` Crash handlers + MQTT reconnection.

**This quarter:**
8. `VAL-01` schema-driven ingest validation; `PID-01` audit public exposure; `SCALE-01` externalize runtime state; hygiene cleanup.

---

## Positive notes (what's already strong)

- **Clean domain-driven architecture** — per-module folders (`auth`, `devices`, `ota`, `pid`, `provisioning`, `scenes`, `matter`, `homes`) with routes/controllers/services separation; the platform concepts (PID product identity, OTA, Matter mapping, provisioning, scenes) are well modeled.
- **TypeScript end-to-end** with shared `packages/` (device-schemas, shared, ui) and **Zod-validated env** (`config/env.ts`) — no hardcoded secret fallbacks observed; MQTT creds come from env.
- **Auth is correctly applied on the user surface** (`homes`, `api-keys`, `matter`, `provisioning`, `scenes`, and the device management routes after the ingest hook) — the pattern is right; it just needs to be extended to the admin routers.
- **Tests exist** (`.spec.tsx` / router specs), `x-powered-by` disabled, and the PWA/admin-ui have real auth-session providers and route guards.
- A **schema-driven device model** (telemetry field definitions with units/min/max, dashboard templates per PID) is exactly the right foundation for a multi-device IoT platform and for the new dashboard UI (see `design/` deliverable).

> **Bottom line:** Strong bones, one urgent gap. The admin/OTA/PID routers must not ship without server-side authentication + authorization — unauthenticated firmware publishing (`SEC-01`) is the single most important fix. Everything else is standard hardening on an otherwise well-built platform.
