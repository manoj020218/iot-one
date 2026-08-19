#pragma once

namespace app {

inline constexpr char kProductName[] = "QRUnlock Smart RF Door Lock PSU";
inline constexpr char kPid[] = "QRUNLOCK-PSU-RF";
inline constexpr char kModel[] = "QRU-PSU-RF-C3";
inline constexpr char kHardwareRevision[] = "HW-C3-PSU-RF-01";
inline constexpr char kFirmwareVersion[] = "1.0.0";
inline constexpr char kBuildId[] = __DATE__ " " __TIME__;
inline constexpr char kNamePrefix[] = "JNX-QRU";
inline constexpr char kMdnsPrefix[] = "jnx-qru";
inline constexpr char kBleServiceUuid[] = "FF00";
inline constexpr char kBleWriteUuid[] = "FF01";
inline constexpr char kBleStatusUuid[] = "FF02";
inline constexpr bool kBleProvisioningEnabled = false;

}  // namespace app
