#pragma once

#include <functional>
#include <string>

#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"

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

  enum class Scheme { Ble, SoftAp };

  // Starts (or switches to, if a different scheme is already active --
  // wifi_prov_mgr is a singleton, only one scheme runs at a time) Security
  // Scheme 2 provisioning advertised as JNX{product_code}{6-hex-STA-MAC}.
  // Caller must have already confirmed no Wi-Fi station credentials are
  // stored (PROVISIONING.md Section 3 Phase 0) -- this does not check that
  // itself.
  //
  // softap_httpd_handle (httpd_handle_t, passed as void* to avoid dragging
  // esp_http_server.h into this header) is only used for Scheme::SoftAp --
  // pass an existing server (e.g. WebService's) so the provisioning
  // endpoints share it instead of a second server conflicting for the AP
  // interface/port 80. Ignored for Scheme::Ble.
  esp_err_t begin(Scheme scheme, const std::string& product_code, const std::string& pid,
                  WifiConnectedHandler on_wifi_connected, void* softap_httpd_handle = nullptr);

  // Dispatches successful Wi-Fi handoff work from the application task. The
  // native provisioning callback runs on ESP-IDF's small sys_evt stack and
  // must not perform std::function, logging, or NVS work directly.
  void tick();

  bool active() const { return active_; }

 private:
  static void handleWifiConnected(const char* device_id, const char* ip, void* ctx);

  bool active_ = false;
  WifiConnectedHandler wifi_connected_handler_;
  QueueHandle_t pending_wifi_queue_ = nullptr;
};

}  // namespace app::services
