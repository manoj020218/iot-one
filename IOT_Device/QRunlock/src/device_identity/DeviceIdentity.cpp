#include "device_identity/DeviceIdentity.h"

#include <esp_system.h>

#include "app/ProductIdentity.h"

namespace identity {

void DeviceIdentity::Begin() {
  const uint64_t mac = ESP.getEfuseMac();
  char suffix[5];
  char hwid[13];
  std::snprintf(suffix, sizeof(suffix), "%04X",
                static_cast<unsigned>(mac & 0xFFFFULL));
  std::snprintf(hwid, sizeof(hwid), "%012llX",
                static_cast<unsigned long long>(mac & 0xFFFFFFFFFFFFULL));
  macSuffix_ = suffix;
  hardwareId_ = hwid;
  deviceId_ = String(app::kPid) + "-" + macSuffix_;
  bleName_ = String(app::kNamePrefix) + "-" + macSuffix_;
  apSsid_ = bleName_;
  mdnsHost_ = String(app::kMdnsPrefix) + "-" + macSuffix_;
  mdnsHost_.toLowerCase();
}

}  // namespace identity
