# Platform Additions Needed for Smart Streamer

Audience: the core Jenix One platform developer (VPS `api-server` +
`web-pwa` shell), not the Smart Streamer team specifically. Everything
below was found by reading the live code, not inferred from the Smart
Streamer spec documents — each item cites the exact file. None of these
are Smart-Streamer-only features; they're gaps in shared platform
infrastructure that Smart Streamer happens to be the first module to need
in a way that makes the gap load-bearing instead of theoretical.

---

## 1. Device authentication is a shared static key, not per-device HMAC

**File**: `VPS/apps/api-server/src/infrastructure/http/require-device-auth.ts`

Today, every device in the fleet that hits a device-facing endpoint
(`POST /api/v1/devices/register`, `POST /api/v1/devices/:deviceId/telemetry`)
authenticates with one shared `x-device-key` value, compared in constant
time against a single `DEVICE_INGEST_KEY` env var — and enforcement is
**off by default** (passes through when the env var is unset). The code's
own comment already names the correct fix: a per-device secret with
HMAC-SHA256 request signing (timestamp + nonce + body-hash), which is
exactly what both the Smart Streamer firmware and VPS specs assume already
exists (`X-Device-ID`/`X-Timestamp`/`X-Nonce`/`X-Signature`).

**Why this matters beyond Smart Streamer**: one leaked shared key
currently lets anyone impersonate telemetry from *any* device across the
whole fleet — Tank Guard, Nurse Call Receiver, everything. This isn't a
Smart Streamer problem, it's a fleet-wide exposure Smart Streamer's spec
happened to notice because it explicitly designs against it.

**Suggested scope**: replace `requireDeviceIngestAuth` with a signature
verifier keyed per-device (secret issued at claim time — see item 3),
apply it to existing routes first, then Smart Streamer's new device routes
use the same middleware from day one. This is the single highest-leverage
item on this list since every other device type benefits immediately.

---

## 2. No cross-module audit log

**Checked**: `packages/shared/src/utils/audit.ts` (a stamping helper —
`actorId`/`action`/`occurredAt`), and per-module ad hoc logs like
`PidAuditLogRecord` in `modules/pid/pid.types.ts` and the home-scoped
`HomeAuditEntry` in `modules/homes/home.model.ts`. Each module invents its
own audit shape and its own storage; there's no shared `audit_logs` table,
no shared query/filter API, no shared "list recent actions for this home
across all modules" endpoint.

Both Smart Streamer specs (VPS §18, PWA §27) ask for an audit trail that
spans device-claim, camera/destination changes, schedule changes,
stream start/stop, force-stop, OTA — i.e. actions across several modules,
surfaced in one timeline. Building that with today's per-module pattern
means either duplicating a fourth bespoke audit shape or the Smart
Streamer team quietly building the shared version themselves inside a
feature module, which is the wrong place for shared infrastructure to
live.

**Suggested scope**: one `audit_logs` table (`homeId, actorId, module,
action, targetType, targetId, occurredAt, summary, requestId`), one
write helper every module calls instead of rolling its own, one read
endpoint (`GET /api/v1/homes/:homeId/audit?module=&from=&to=`) the PWA's
audit views (present and future) all consume.

---

## 3. No notifications module at all

**Checked**: no directory or file matching `notif`/`alert` anywhere under
`VPS/apps/api-server/src/modules/`. Both Smart Streamer specs (firmware
§ control-plane, PWA §16) assume "the existing Jenix One notification
framework" — it doesn't exist yet, in any form, for any device type.

This is the largest genuinely-new piece of platform infrastructure this
project surfaces. It isn't Smart-Streamer-shaped work (stream
started/stopped/failed is just one more event source) — it's: a
subscription model (per-user, per-event-type preferences), a delivery
mechanism (push? email? in-app only for v1?), and dedup/cooldown logic
(explicitly required so "device offline" doesn't spam on every failed
heartbeat). Recommend scoping this as its own platform initiative with
Smart Streamer as the first consumer, not something built inside the
Smart Streamer module and generalized later — the second path tends to
produce a "notifications API" that's secretly shaped like one product's
needs.

**Interim**: `VPS/API_CONTRACT.md` (Smart Streamer folder) tells the Smart
Streamer VPS developer to stub emit points now so wiring a real sink later
is additive.

---

## 4. Admin role checks are a spoofable header, not verified claims

**File**: `VPS/apps/api-server/src/infrastructure/http/require-admin.ts`
(and wherever `x-role` is read for admin controllers).

The code comment already documents this: admin controllers check an
`x-role` header, "trivially spoofable," with a noted follow-up to move
role derivation into verified JWT claims. Smart Streamer's permission
model (`smart_streamer.stream.force_stop`,
`smart_streamer.device.release`, etc. — PWA spec §17) explicitly requires
server-enforced RBAC, and force-stop/release are exactly the kind of
destructive, audit-logged actions where a spoofable role header is a real
risk, not a theoretical one.

**Suggested scope**: extend the JWT issued by `auth.service.ts` to carry
signed role/permission claims, derive `req.role` from that instead of a
header, on the admin path first (highest existing exposure) and make it
the only path available to new modules like Smart Streamer.

---

## 5. Provisioning: app side is real, firmware side isn't — on any device

**File**: `PROVISIONING.md` (root) §7 fleet table — every device, including
the designated pilot (Tank Guard), is marked "pending." Confirmed by
direct inspection: no `wifi_prov_mgr_*`/`protocomm_*` calls exist in Tank
Guard's firmware (`IOT_Device/Tank Guard/Firmware/Sensor/A02W/HW/src/`) or
Smart Streamer's (`IOT_Device/Smart Streamer/firmware/main/` only has an
ad hoc SoftAP test harness). The PWA-side BLE/AP flow
(`web-pwa/src/features/provisioning/`) is real and works against
Espressif's reference protocol already.

This isn't core-platform code (it's per-device-firmware work, own by each
device's firmware developer), but it's listed here because it's a
**shared blocking dependency** two unrelated teams (Tank Guard, Smart
Streamer) are both implicitly waiting on, and per PROVISIONING.md's own
stated rollout order, Tank Guard should validate first. Recommend the
platform maintainer actively track this as a named milestone rather than
letting it stay implicit in a doc — right now nothing forces the "pilot
first" sequencing PROVISIONING.md asks for.

---

## 6. No cheap "does this home own a device of PID family X" check

Raised in `PWA tool/UI_UX_PLAN.md` §1/§3: Smart Streamer's plan is to show
its bottom-nav entry only to homes that actually own a Smart Streamer
device, to avoid cluttering navigation for every other product's
customers. Today that requires the client to fetch the full device list
and filter client-side — fine for one module, but if every future product
plugin (P10 Display, SOS Siren, etc.) does the same thing independently,
that's N redundant full-list fetches on every app load.

**Suggested scope**: a lightweight `GET /api/v1/homes/:homeId/pid-families`
(or bundle it into the existing home-bootstrap payload if one already
loads on login) returning just the distinct PID families the home owns —
cheap to compute server-side, reusable by every plugin's nav-gating logic.

---

## 7. The 200-line file convention has no enforcement anywhere

**Checked**: `eslint.config.mjs` has no `max-lines` rule. Mentioned once in
`DEVICE_INTEGRATION_GUIDE.md:37` for a specific component set, ignored
everywhere else — `home.service.ts` (925 lines), `scene.service.ts` (909),
`deviceManagementApi.ts` (844 lines on the PWA side) all far exceed it.

Smart Streamer's three specs all commit to this limit hard. If it's meant
to actually hold this time (not just for Smart Streamer, but as a
direction for the platform), a one-line ESLint addition
(`"max-lines": ["warn", 200]`) makes it visible in CI instead of aspirational
in a markdown file. Suggest `warn` not `error` initially, given how much
existing code would immediately fail an `error`-level gate.
