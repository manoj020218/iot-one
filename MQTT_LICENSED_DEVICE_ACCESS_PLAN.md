# Licensed MQTT Device Access Plan

## Purpose

This document defines the recommended security model for letting devices talk to Jenix One over MQTT without trusting only a broker host, port, or shared password.

The target outcome is:

- only approved devices can connect
- each device can publish and subscribe only inside its own namespace
- Jenix can revoke access without reflashing the whole fleet
- third-party OEM devices can buy access to Jenix infrastructure in a controlled way
- billing, quota, and product entitlement can be enforced centrally

## Problem Statement

The current broker posture is not sufficient for a production IoT platform:

- anonymous broker access must not remain enabled
- a raw MQTT host and port must never be enough to join the platform
- shared broker credentials are not acceptable for a multi-tenant future
- static ACLs alone do not create a sellable third-party platform model

The old idea of an "encrypted license file" is directionally useful, but by itself it is not enough. If a file can be copied from one device to another, the second device may impersonate the first one unless there is also a device-bound cryptographic identity.

## Recommended Decision

Use a layered model:

1. Every device gets a unique device identity.
2. Every approved device gets a signed license manifest.
3. MQTT access is granted only after license validation.
4. Broker credentials must be short-lived or certificate-based, not shared forever.
5. Topic ACLs must be derived from license and device identity, not handwritten globally.

For Jenix first-party devices, the recommended long-term model is:

- device keypair burned during manufacturing
- signed Jenix license manifest bound to `deviceId`, `pid`, and device public key
- short-lived MQTT token or client certificate issued by Jenix after validation

For third-party devices, the recommended model is:

- vendor account in Jenix One
- vendor package and billing plan
- vendor root signing identity or Jenix-issued onboarding credential
- device-specific license issued under that vendor contract

## Why A Plain Encrypted License File Is Not Enough

An encrypted file alone has four weaknesses:

1. If the same decryption secret exists in every device, compromise of one device compromises all.
2. If the file is copied to another board, the platform cannot prove the board is genuine.
3. Rotation and revocation become operationally weak.
4. Paid access is hard to meter because entitlement is not strongly bound to a tenant and a device identity.

So the correct model is:

- signed license manifest
- device-bound keypair
- broker-side enforcement

Encryption may still be used at rest on the device, but signature verification is the real trust anchor.

## Security Model

### 1. Device Identity

Each device must have:

- `deviceId`
- `pid`
- immutable `deviceUid`
- device public key
- device private key stored in the most protected location available

Preferred protection levels:

1. Best: secure element or hardware-backed key storage
2. Good: ESP secure boot + flash encryption + NVS encryption
3. Minimum transitional: encrypted flash only, with explicit clone-risk acceptance

### 2. License Manifest

Each approved device gets a signed license manifest containing:

- `licenseId`
- `tenantId` or `vendorId`
- `deviceId`
- `deviceUid`
- `pid`
- allowed MQTT topic templates
- allowed actions and feature flags
- message rate limits
- issued-at time
- expiry time
- billing plan code
- revocation generation
- Jenix issuer signature

This manifest may be stored on the device as a "license file", but it must be signed by Jenix. The device and the server both validate it.

### 3. MQTT Access Grant

Do not keep one permanent broker password in every device.

Use one of these models:

1. Transitional model
- Device stores signed license + device secret
- Device receives per-device MQTT username/password
- Broker ACL allows only that device namespace

2. Recommended model
- Device presents signed license and proves possession of its private key
- Jenix Access Service issues short-lived MQTT token
- Broker validates token claims and topic scope

3. Highest-security model
- Device uses mutual TLS client certificate
- Broker maps certificate identity to ACL policy
- Jenix still keeps the license manifest for business entitlements

## Recommended MQTT Architecture For Jenix One

### Control Plane

Jenix One backend should own:

- license issuance
- license revocation
- token issuance
- vendor onboarding
- billing entitlement checks
- audit logging

### Data Plane

The MQTT broker should only enforce:

- authentication
- connection policy
- topic ACL policy
- TLS policy
- rate limits if supported

Do not put billing logic directly into the broker. Let the broker consume already-authorized claims.

## Topic Isolation Model

Every device must be confined to its own namespace.

Suggested pattern:

- telemetry write: `jnx/dev/{tenantId}/{deviceId}/telemetry`
- status write: `jnx/dev/{tenantId}/{deviceId}/status`
- events write: `jnx/dev/{tenantId}/{deviceId}/events/#`
- command read: `jnx/dev/{tenantId}/{deviceId}/cmd`
- ota read: `jnx/dev/{tenantId}/{deviceId}/ota`
- ack write: `jnx/dev/{tenantId}/{deviceId}/ack`

The platform runtime can still bridge to aggregate topics internally if needed, but devices should not be allowed broad `jenix/runtime/#` access.

## Enrollment Flow

### Jenix First-Party Device

1. Factory flashes firmware with device keypair or secure-element identity.
2. Factory or backend issues signed license manifest for that exact device.
3. Device is provisioned into a HOME.
4. Device calls Jenix enrollment API over HTTPS.
5. Backend verifies:
- device signature challenge
- license signature
- license not expired
- license not revoked
- `pid` and `deviceId` consistency
6. Backend returns:
- short-lived MQTT token or client cert reference
- broker host `mqtt.iotsoft.in`
- topic namespace claims
7. Device connects to MQTT using those issued credentials.

### Third-Party Device

1. Vendor signs commercial agreement and gets `vendorId`.
2. Jenix creates a vendor package with quotas and allowed PIDs or connector types.
3. Vendor either:
- submits device public keys for pre-registration, or
- uses Jenix onboarding API to register devices dynamically
4. Jenix issues signed license manifests under that vendor plan.
5. Devices enroll and receive scoped MQTT credentials the same way.

## Paid Access Model

This architecture supports paid access cleanly.

Commercial units should be:

- vendor account
- package or plan
- active licensed device count
- monthly message quota
- enabled feature flags
- per-PID enablement
- optional regional data residency

Example paid tiers:

- `connect-basic`: telemetry + status only
- `connect-control`: adds command and OTA channels
- `connect-scenes`: adds scene integration
- `connect-oem`: adds white-label and higher quotas

License enforcement points:

- license issuance allowed only for active subscriptions
- token issuance blocked when account is suspended
- topic claim set varies by plan
- quotas and overages audited at backend level

## Revocation And Rotation

The platform must support:

- immediate device revocation
- vendor-wide revocation
- key rotation
- manifest expiry and renewal
- emergency broker deny list

Recommended controls:

- short token lifetime such as 15 minutes to 24 hours
- refresh only through HTTPS enrollment or refresh API
- `revocationGeneration` field in license manifest
- cached deny list on access service

## Recommended Implementation Phases

### Phase A - Broker Hardening

- set `allow_anonymous false`
- require authentication
- remove broad anonymous ACLs
- isolate Jenix runtime topics from device topics

### Phase B - Per-Device Credentials

- generate unique MQTT credentials per device
- store them in a device credential repository
- enforce per-device ACLs

This is the minimum production-safe checkpoint.

### Phase C - Signed License Manifests

- add license issuance service
- add license repository
- add admin UI for license status
- bind device credentials to license state

### Phase D - Short-Lived MQTT Tokens

- add MQTT access service
- device authenticates over HTTPS
- backend returns expiring MQTT token with claims
- broker validates token and enforces ACL by claim

### Phase E - Third-Party Vendor Access

- add vendor accounts and billing plan model
- add vendor onboarding APIs
- add usage metering and suspension rules

## Suggested Jenix One Work Areas

Suggested future folders:

- `packages/shared/src/types/device-license.ts`
- `packages/shared/src/types/vendor-access.ts`
- `VPS/apps/api-server/src/modules/device-licenses`
- `VPS/apps/api-server/src/modules/device-enrollment`
- `VPS/apps/api-server/src/modules/vendors`
- `VPS/apps/api-server/src/modules/billing-entitlements`
- `VPS/apps/api-server/src/infrastructure/mqtt/authz`
- `VPS/apps/admin-backend-ui/src/features/device-licenses`
- `VPS/apps/admin-backend-ui/src/features/vendors`

## Recommendation Summary

Do not build the future around only an encrypted license file.

Build around:

- device-bound cryptographic identity
- signed license manifest
- short-lived or certificate-based MQTT access
- broker-enforced per-device topic isolation
- backend-controlled entitlements and billing

That gives Jenix One:

- stronger first-party security
- safe third-party onboarding
- revocation capability
- paid platform access in the future

## Current Status

This document is a plan only.

No broker hardening, no license service, and no token service are implemented by this document.
