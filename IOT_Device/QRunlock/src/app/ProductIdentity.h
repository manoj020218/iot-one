#pragma once

namespace app {

inline constexpr char kProductName[] = "QRUnlock Smart RF Door Lock PSU";
inline constexpr char kPid[] = "JNX-QRU-C3-001";
inline constexpr char kModel[] = "QRU-PSU-RF-C3";
// Product taxonomy — mirrors the PID record's productCategory/productLine
// fields (packages/device-schemas/src/pid/pid.types.ts) once the real PID
// is issued; keep both in sync by hand, same convention as kPid above.
// RIM Lock = an electric strike/RIM-latch lock that only ever needs a
// momentary relay pulse to release — this is why the platform's unlock
// action is inching-only, never a held on/off relay state (see
// IOT_Device/QRunlock/VPS/src/lock/lock.service.ts).
inline constexpr char kProductCategory[] = "Lock";
inline constexpr char kProductLine[] = "RIM Lock";
inline constexpr char kHardwareRevision[] = "HW-C3-PSU-RF-01";
inline constexpr char kFirmwareVersion[] = "1.0.0";
inline constexpr char kBuildId[] = __DATE__ " " __TIME__;
inline constexpr char kProvisioningNamePrefix[] = "JNXQRU";
inline constexpr char kDeviceIdPrefix[] = "JNX-QRU-C3";
inline constexpr char kMdnsPrefix[] = "jnx-qru";
inline constexpr char kBleServiceUuid[] = "FF00";
inline constexpr char kBleWriteUuid[] = "FF01";
inline constexpr char kBleStatusUuid[] = "FF02";
inline constexpr bool kBleProvisioningEnabled = true;
inline constexpr bool kMatterEnabled = false;

}  // namespace app
