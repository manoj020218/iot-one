/**
 * QRUNLOCK_PID must match `kPid` in
 * IOT_Device/QRunlock/src/app/ProductIdentity.h exactly — that header is
 * the firmware's source of truth, this is the backend's copy of the same
 * value. Once the platform lead issues the real PID record through
 * POST /api/v1/admin/pids (see API_CONTRACT.md §0), this constant should
 * be updated to match whatever `pid` value that record was created with —
 * the two are kept in sync by hand, there is no shared file firmware and
 * this package both import from.
 */
export const QRUNLOCK_PID = "JNX-QRU-C3-001";

/**
 * Relay timing bounds and firmware-reported defaults, copied from
 * IOT_Device/QRunlock/src/config/Defaults.h. relayPulseMs is currently
 * fixed at manufacturing (kMinRelayPulseMs === kMaxRelayPulseMs === 300 in
 * firmware today) — reported read-only here, not exposed as settable,
 * because the firmware itself does not let it vary. Only relayCooldownMs
 * is genuinely tunable. If firmware ever widens the pulse range, update
 * both this file and settings/settings.validation.ts together.
 */
export const QRUNLOCK_FIXED_RELAY_PULSE_MS = 300;
export const QRUNLOCK_DEFAULT_RELAY_COOLDOWN_MS = 1500;
export const QRUNLOCK_MIN_RELAY_COOLDOWN_MS = 0;
export const QRUNLOCK_MAX_RELAY_COOLDOWN_MS = 10000;

/** Matches config::kRfLearnWindowMs in Defaults.h — the firmware's own RF-learn timeout. */
export const QRUNLOCK_RF_LEARN_WINDOW_MS = 10000;
