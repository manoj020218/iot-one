#include "services/provisioning_service.h"

#ifdef JENIX_PROV_STANDARD
#include "jenix_provisioning.h"
#endif

namespace app::services {

#ifdef JENIX_PROV_STANDARD
namespace {

void HandleWifiConnected(const char* device_id, const char* ip, void* ctx) {
  auto* handler = static_cast<ProvisioningService::WifiConnectedHandler*>(ctx);
  if (handler != nullptr && *handler) {
    (*handler)(device_id != nullptr ? device_id : "", ip != nullptr ? ip : "");
  }
}

}  // namespace

esp_err_t ProvisioningService::begin(const std::string& product_code, const std::string& pid,
                                      WifiConnectedHandler on_wifi_connected) {
  static WifiConnectedHandler stored_handler;
  stored_handler = std::move(on_wifi_connected);

  jenix_provisioning_config_t config = {};
  config.product_code = product_code.c_str();
  config.pid = pid.c_str();
  config.proof_of_possession = nullptr;  // first-boot-generate + persist to NVS

  jenix_provisioning_callbacks_t callbacks = {};
  callbacks.on_wifi_connected = &HandleWifiConnected;

  const esp_err_t err =
      jenix_provisioning_start(JENIX_PROV_SCHEME_BLE, &config, &callbacks, &stored_handler);
  active_ = (err == ESP_OK);
  return err;
}

#else

esp_err_t ProvisioningService::begin(const std::string& /*product_code*/,
                                      const std::string& /*pid*/,
                                      WifiConnectedHandler /*on_wifi_connected*/) {
  return ESP_ERR_NOT_SUPPORTED;
}

#endif

}  // namespace app::services
