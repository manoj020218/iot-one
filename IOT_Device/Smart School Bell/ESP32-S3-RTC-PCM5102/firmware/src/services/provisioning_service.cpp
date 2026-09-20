#include "services/provisioning_service.h"

#include <cstdio>

#ifdef JENIX_PROV_STANDARD
#include "jenix_provisioning.h"
#endif

namespace app::services {

#ifdef JENIX_PROV_STANDARD
namespace {

struct PendingWifiConnected {
  char device_id[32];
  char ip[16];
};

}  // namespace

void ProvisioningService::handleWifiConnected(const char* device_id, const char* ip, void* ctx) {
  auto* self = static_cast<ProvisioningService*>(ctx);
  if (self == nullptr || self->pending_wifi_queue_ == nullptr) return;

  PendingWifiConnected pending = {};
  std::snprintf(pending.device_id, sizeof(pending.device_id), "%s",
                device_id != nullptr ? device_id : "");
  std::snprintf(pending.ip, sizeof(pending.ip), "%s", ip != nullptr ? ip : "");
  xQueueOverwrite(self->pending_wifi_queue_, &pending);
}

esp_err_t ProvisioningService::begin(Scheme scheme, const std::string& product_code,
                                      const std::string& pid, WifiConnectedHandler on_wifi_connected,
                                      void* softap_httpd_handle) {
  wifi_connected_handler_ = std::move(on_wifi_connected);
  if (pending_wifi_queue_ == nullptr) {
    pending_wifi_queue_ = xQueueCreate(1, sizeof(PendingWifiConnected));
    if (pending_wifi_queue_ == nullptr) return ESP_ERR_NO_MEM;
  }

  jenix_provisioning_config_t config = {};
  config.product_code = product_code.c_str();
  config.pid = pid.c_str();
  config.proof_of_possession = nullptr;  // first-boot-generate + persist to NVS
  config.softap_httpd_handle = softap_httpd_handle;

  jenix_provisioning_callbacks_t callbacks = {};
  callbacks.on_wifi_connected = &ProvisioningService::handleWifiConnected;

  const jenix_provisioning_scheme_t native_scheme =
      (scheme == Scheme::SoftAp) ? JENIX_PROV_SCHEME_SOFTAP : JENIX_PROV_SCHEME_BLE;
  const esp_err_t err =
      jenix_provisioning_start(native_scheme, &config, &callbacks, this);
  active_ = (err == ESP_OK);
  return err;
}

void ProvisioningService::tick() {
  if (pending_wifi_queue_ == nullptr) return;

  PendingWifiConnected pending = {};
  if (xQueueReceive(pending_wifi_queue_, &pending, 0) == pdTRUE && wifi_connected_handler_) {
    wifi_connected_handler_(pending.device_id, pending.ip);
  }
}

#else

esp_err_t ProvisioningService::begin(Scheme /*scheme*/, const std::string& /*product_code*/,
                                      const std::string& /*pid*/,
                                      WifiConnectedHandler /*on_wifi_connected*/,
                                      void* /*softap_httpd_handle*/) {
  return ESP_ERR_NOT_SUPPORTED;
}

void ProvisioningService::tick() {}

#endif

}  // namespace app::services
