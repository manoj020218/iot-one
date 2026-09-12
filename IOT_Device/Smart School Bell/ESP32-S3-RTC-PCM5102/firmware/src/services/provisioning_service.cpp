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

esp_err_t ProvisioningService::begin(Scheme scheme, const std::string& product_code,
                                      const std::string& pid, WifiConnectedHandler on_wifi_connected,
                                      void* softap_httpd_handle) {
  static WifiConnectedHandler stored_handler;
  stored_handler = std::move(on_wifi_connected);

  jenix_provisioning_config_t config = {};
  config.product_code = product_code.c_str();
  config.pid = pid.c_str();
  config.proof_of_possession = nullptr;  // first-boot-generate + persist to NVS
  config.softap_httpd_handle = softap_httpd_handle;

  jenix_provisioning_callbacks_t callbacks = {};
  callbacks.on_wifi_connected = &HandleWifiConnected;

  const jenix_provisioning_scheme_t native_scheme =
      (scheme == Scheme::SoftAp) ? JENIX_PROV_SCHEME_SOFTAP : JENIX_PROV_SCHEME_BLE;
  const esp_err_t err =
      jenix_provisioning_start(native_scheme, &config, &callbacks, &stored_handler);
  active_ = (err == ESP_OK);
  return err;
}

#else

esp_err_t ProvisioningService::begin(Scheme /*scheme*/, const std::string& /*product_code*/,
                                      const std::string& /*pid*/,
                                      WifiConnectedHandler /*on_wifi_connected*/,
                                      void* /*softap_httpd_handle*/) {
  return ESP_ERR_NOT_SUPPORTED;
}

#endif

}  // namespace app::services
