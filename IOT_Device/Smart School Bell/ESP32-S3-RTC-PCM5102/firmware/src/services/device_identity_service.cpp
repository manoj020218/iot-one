#include "services/device_identity_service.h"

#include <cstdio>

#include "app_config.h"
#include "esp_mac.h"

#ifdef JENIX_PROV_STANDARD
#include "jenix_provisioning.h"
#endif

namespace app::services {

esp_err_t DeviceIdentityService::init() {
  uint8_t mac[6] = {};
  const esp_err_t err = esp_read_mac(mac, ESP_MAC_WIFI_STA);
  if (err != ESP_OK) return err;

  char hardware_id[13] = {};
  char suffix[7] = {};
  std::snprintf(hardware_id, sizeof(hardware_id), "%02X%02X%02X%02X%02X%02X",
                mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  std::snprintf(suffix, sizeof(suffix), "%02X%02X%02X", mac[3], mac[4], mac[5]);
  hardware_id_ = hardware_id;
  mac_suffix_ = suffix;
#ifdef JENIX_PROV_STANDARD
  // PROVISIONING.md Section 2: JNX{product_code}{6-hex-STA-MAC}, no
  // separators -- reserved product code "SB". Only takes effect in the
  // provisioning pilot env; the shipping env keeps the legacy
  // JNX-SB-S3-{mac} form below untouched.
  char standard_name[16] = {};
  if (jenix_provisioning_build_name("SB", standard_name, sizeof(standard_name)) == ESP_OK) {
    device_id_ = standard_name;
  } else {
    device_id_ = std::string(config::kDeviceIdPrefix) + "-" + mac_suffix_;
  }
#else
  device_id_ = std::string(config::kDeviceIdPrefix) + "-" + mac_suffix_;
#endif

  char mdns_suffix[7] = {};
  std::snprintf(mdns_suffix, sizeof(mdns_suffix), "%02x%02x%02x", mac[3], mac[4], mac[5]);
  mdns_hostname_ = std::string(config::kMdnsPrefix) + "-" + mdns_suffix;
  return ESP_OK;
}

}  // namespace app::services
