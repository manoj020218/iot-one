#pragma once

#include <functional>
#include <string>

#include "esp_err.h"

namespace app::services {

// Thin wrapper around the shared jenix_provisioning component
// (IOT_Device/_shared/jenix_provisioning) -- see ../../PROVISIONING_PARITY_MASTER_PROMPT.md
// and ../../../../PROVISIONING.md Sections 1-3/8a/11.
//
// This class always compiles, in both the default esp32-s3-schoolbell env
// and the esp32-s3-schoolbell-prov env. Only the prov env (JENIX_PROV_STANDARD)
// actually links the shared component and does anything; in the default env
// begin() is a no-op that returns ESP_ERR_NOT_SUPPORTED, so app_main.cpp
// does not need to branch on the build flag itself.
class ProvisioningService {
 public:
  using WifiConnectedHandler =
      std::function<void(const std::string& device_id, const std::string& ip)>;

  // Starts BLE Security Scheme 2 provisioning advertised as
  // JNX{product_code}{6-hex-STA-MAC}. Caller must have already confirmed no
  // Wi-Fi station credentials are stored (PROVISIONING.md Section 3 Phase 0)
  // -- this does not check that itself.
  esp_err_t begin(const std::string& product_code, const std::string& pid,
                  WifiConnectedHandler on_wifi_connected);

  bool active() const { return active_; }

 private:
  bool active_ = false;
};

}  // namespace app::services
