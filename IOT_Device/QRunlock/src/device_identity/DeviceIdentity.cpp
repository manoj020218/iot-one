#include "device_identity/DeviceIdentity.h"

#include <cstdio>

#include <esp_system.h>

#include "app/ProductIdentity.h"

namespace identity {

void DeviceIdentity::Begin() {
  const uint64_t mac = ESP.getEfuseMac();
  char suffix[7];
  char hwid[13];
  // ESP.getEfuseMac() packs MAC bytes in reverse order vs. the conventional
  // AA:BB:CC:DD:EE:FF display (confirmed against real captured hardwareId
  // strings) - bits [47:24] hold the last 3 (per-chip-unique) display
  // bytes, bits [23:0] hold the first 3 (shared vendor OUI) bytes. Masking
  // the low 24 bits instead of shifting first grabs the OUI, which is
  // identical across nearly every ESP32-C3 Espressif has sold - that
  // collision was caught by two real boards producing the same BLE name.
  std::snprintf(suffix, sizeof(suffix), "%06X",
                static_cast<unsigned>((mac >> 24) & 0xFFFFFFULL));
  std::snprintf(hwid, sizeof(hwid), "%012llX",
                static_cast<unsigned long long>(mac & 0xFFFFFFFFFFFFULL));
  macSuffix_ = suffix;
  hardwareId_ = hwid;
  deviceId_ = String(app::kDeviceIdPrefix) + "-" + macSuffix_;
  bleName_ = String(app::kProvisioningNamePrefix) + macSuffix_;
  apSsid_ = bleName_;
  mdnsHost_ = String(app::kMdnsPrefix) + "-" + macSuffix_;
  mdnsHost_.toLowerCase();
}

}  // namespace identity
