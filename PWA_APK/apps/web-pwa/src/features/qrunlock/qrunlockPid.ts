/**
 * Must match `kPid` in IOT_Device/QRunlock/src/app/ProductIdentity.h and
 * QRUNLOCK_PID in IOT_Device/QRunlock/VPS/src/constants.ts — all three are
 * kept in sync by hand until the platform lead issues the real PID record
 * through POST /api/v1/admin/pids (see IOT_Device/QRunlock/VPS/
 * API_CONTRACT.md §0), same interim state Smart Streamer's
 * smartStreamerPid.ts documents for its own PID.
 */
export const QRUNLOCK_PID = "JNX-QRU-C3-001";
