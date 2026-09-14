/**
 * Interim PID constant — no PID record exists yet in the admin catalog
 * (provisioning/PID registration is deliberately deferred, see the
 * project's own PLAN docs). Follows the same placeholder pattern as
 * QRUNLOCK_PID (features/qrunlock/qrunlockPid.ts): kept in sync by hand
 * with the firmware side until POST /api/v1/admin/pids is actually called
 * for this product. Family "SB" = School Bell, MCU "S3" = ESP32-S3.
 */
export const SCHOOL_BELL_PID = "JNX-SB-S3-001";
