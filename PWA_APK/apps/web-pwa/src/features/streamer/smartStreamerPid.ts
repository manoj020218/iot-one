/**
 * Matches the deviceCatalog.ts entry (features/devices/deviceCatalog.ts)
 * and the platform's real PID convention: JNX-{code}-{chip}-{seq}, same
 * pattern as JNX-TG-C3-001 for Tank Guard. "SS" is Smart Streamer's
 * product code and "P4" its chip, per PROVISIONING.md §2. Still provisional
 * until the VPS/PID module actually registers this PID (see
 * VPS/API_CONTRACT.md and SMART_STREAMER_PLATFORM_ADDITIONS.md item 6 —
 * no cheap ownership check exists yet either, so this filters the full
 * device list client-side as an interim) — but no longer an arbitrary
 * placeholder, it's the value that convention dictates.
 */
export const SMART_STREAMER_PID = "JNX-SS-P4-001";
