#include "device_identity/DeviceIdentity.h"

#include <esp_system.h>

#include "app/ProductIdentity.h"

namespace identity {

void DeviceIdentity::Begin() {
  const uint64_t mac = ESP.getEfuseMac();
  char suffix[7];
  char hwid[13];
  std::snprintf(suffix, sizeof(suffix), "%06X",
                static_cast<unsigned>(mac & 0xFFFFFFULL));
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
