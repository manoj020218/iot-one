#include "services/wifi_service.h"

#include <cstdio>
#include <cstring>

#include "app_config.h"
#include "esp_check.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_netif_ip_addr.h"
#include "esp_wifi.h"
#include "mdns.h"
#include "nvs.h"

namespace app::services {

namespace {
constexpr char kTag[] = "WifiService";
constexpr char kNvsNamespace[] = "jenix_wifi";
constexpr char kNvsSsid[] = "ssid";
constexpr char kNvsPassword[] = "password";
}

esp_err_t WifiService::init(const DeviceConfig& config) {
  active_ssid_.clear();
  station_ip_.clear();
  connected_ = false;
  ap_started_ = false;

  ESP_RETURN_ON_ERROR(esp_netif_init(), kTag, "esp_netif_init failed");
  const esp_err_t loop_result = esp_event_loop_create_default();
  if (loop_result != ESP_OK && loop_result != ESP_ERR_INVALID_STATE) return loop_result;
  stack_ready_ = true;

  esp_netif_create_default_wifi_ap();
  esp_netif_create_default_wifi_sta();
  wifi_init_config_t init_config = WIFI_INIT_CONFIG_DEFAULT();
  ESP_RETURN_ON_ERROR(esp_wifi_init(&init_config), kTag, "esp_wifi_init failed");

  ESP_RETURN_ON_ERROR(esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &WifiService::eventHandler, this, nullptr), kTag, "wifi handler register failed");
  ESP_RETURN_ON_ERROR(esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &WifiService::eventHandler, this, nullptr), kTag, "ip handler register failed");

  std::string station_ssid = config.wifi.ssid;
  std::string station_password = config.wifi.password;
  loadSavedStation(&station_ssid, &station_password);
  station_configured_ = !station_ssid.empty();

  wifi_config_t ap_config = {};
  std::snprintf(reinterpret_cast<char*>(ap_config.ap.ssid), sizeof(ap_config.ap.ssid), "%s", app::config::kSetupApSsid);
  std::snprintf(reinterpret_cast<char*>(ap_config.ap.password), sizeof(ap_config.ap.password), "%s", app::config::kSetupApPassword);
  ap_config.ap.ssid_len = std::strlen(app::config::kSetupApSsid);
  ap_config.ap.channel = 1;
  ap_config.ap.max_connection = 4;
  ap_config.ap.authmode = WIFI_AUTH_WPA2_PSK;
  ap_config.ap.pmf_cfg.required = false;

  ESP_RETURN_ON_ERROR(esp_wifi_set_mode(station_configured_ ? WIFI_MODE_APSTA : WIFI_MODE_AP), kTag, "set mode failed");
  ESP_RETURN_ON_ERROR(esp_wifi_set_config(WIFI_IF_AP, &ap_config), kTag, "AP config failed");
  if (station_configured_) {
    wifi_config_t station_config = {};
    std::snprintf(reinterpret_cast<char*>(station_config.sta.ssid), sizeof(station_config.sta.ssid), "%s", station_ssid.c_str());
    std::snprintf(reinterpret_cast<char*>(station_config.sta.password), sizeof(station_config.sta.password), "%s", station_password.c_str());
    station_config.sta.threshold.authmode = station_password.empty() ? WIFI_AUTH_OPEN : WIFI_AUTH_WPA2_PSK;
    station_config.sta.pmf_cfg.capable = true;
    station_config.sta.pmf_cfg.required = false;
    ESP_RETURN_ON_ERROR(esp_wifi_set_config(WIFI_IF_STA, &station_config), kTag, "station config failed");
  }
  ESP_RETURN_ON_ERROR(esp_wifi_start(), kTag, "wifi start failed");

  if (!mdns_hostname_.empty()) {
    const esp_err_t mdns_result = mdns_init();
    if (mdns_result == ESP_OK) {
      mdns_hostname_set(mdns_hostname_.c_str());
      mdns_instance_name_set("Jenix SchoolBell");
      mdns_service_add("Jenix SchoolBell", "_http", "_tcp", app::config::kHttpPort, nullptr, 0);
      ESP_LOGI(kTag, "mDNS ready: http://%s.local/", mdns_hostname_.c_str());
    } else {
      ESP_LOGW(kTag, "mDNS init failed: %s", esp_err_to_name(mdns_result));
    }
  }

  ap_started_ = true;
  active_ssid_ = station_ssid;
  ESP_LOGI(kTag, "Setup AP ready: %s", app::config::kSetupApSsid);
  return ESP_OK;
}

esp_err_t WifiService::applyStationConfig(const std::string& ssid, const std::string& password) {
  if (!stack_ready_ || ssid.size() > 32 || password.size() > 63 || (!password.empty() && password.size() < 8)) {
    return ESP_ERR_INVALID_ARG;
  }
  ESP_RETURN_ON_ERROR(saveStation(ssid, password), kTag, "save station credentials failed");

  connected_ = false;
  station_configured_ = !ssid.empty();
  active_ssid_ = ssid;
  if (!station_configured_) {
    esp_wifi_disconnect();
    return esp_wifi_set_mode(WIFI_MODE_AP);
  }

  wifi_config_t station_config = {};
  std::snprintf(reinterpret_cast<char*>(station_config.sta.ssid), sizeof(station_config.sta.ssid), "%s", ssid.c_str());
  std::snprintf(reinterpret_cast<char*>(station_config.sta.password), sizeof(station_config.sta.password), "%s", password.c_str());
  station_config.sta.threshold.authmode = password.empty() ? WIFI_AUTH_OPEN : WIFI_AUTH_WPA2_PSK;
  station_config.sta.pmf_cfg.capable = true;
  station_config.sta.pmf_cfg.required = false;
  ESP_RETURN_ON_ERROR(esp_wifi_set_mode(WIFI_MODE_APSTA), kTag, "enable AP+station failed");
  ESP_RETURN_ON_ERROR(esp_wifi_set_config(WIFI_IF_STA, &station_config), kTag, "update station config failed");
  const esp_err_t connect_result = esp_wifi_connect();
  return connect_result == ESP_ERR_WIFI_CONN ? ESP_OK : connect_result;
}

const char* WifiService::apSsid() const {
  return app::config::kSetupApSsid;
}

esp_err_t WifiService::loadSavedStation(std::string* ssid, std::string* password) const {
  if (ssid == nullptr || password == nullptr) return ESP_ERR_INVALID_ARG;
  nvs_handle_t handle = 0;
  const esp_err_t open_result = nvs_open(kNvsNamespace, NVS_READONLY, &handle);
  if (open_result == ESP_ERR_NVS_NOT_FOUND) return ESP_OK;
  if (open_result != ESP_OK) return open_result;

  char saved_ssid[33] = {};
  char saved_password[64] = {};
  size_t ssid_size = sizeof(saved_ssid);
  size_t password_size = sizeof(saved_password);
  if (nvs_get_str(handle, kNvsSsid, saved_ssid, &ssid_size) == ESP_OK) *ssid = saved_ssid;
  if (nvs_get_str(handle, kNvsPassword, saved_password, &password_size) == ESP_OK) *password = saved_password;
  nvs_close(handle);
  return ESP_OK;
}

esp_err_t WifiService::saveStation(const std::string& ssid, const std::string& password) const {
  nvs_handle_t handle = 0;
  ESP_RETURN_ON_ERROR(nvs_open(kNvsNamespace, NVS_READWRITE, &handle), kTag, "NVS open failed");
  esp_err_t err = nvs_set_str(handle, kNvsSsid, ssid.c_str());
  if (err == ESP_OK) err = nvs_set_str(handle, kNvsPassword, password.c_str());
  if (err == ESP_OK) err = nvs_commit(handle);
  nvs_close(handle);
  return err;
}

void WifiService::tick() {}

void WifiService::eventHandler(void* arg, esp_event_base_t event_base, int32_t event_id, void* event_data) {
  auto* self = static_cast<WifiService*>(arg);
  if (self == nullptr) return;

  if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
    if (self->station_configured_) esp_wifi_connect();
    return;
  }

  if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
    self->connected_ = false;
    self->station_ip_.clear();
    if (self->station_configured_) {
      ESP_LOGW(kTag, "Wi-Fi disconnected, retrying");
      esp_wifi_connect();
    }
    return;
  }

  if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
    const auto* got_ip = static_cast<const ip_event_got_ip_t*>(event_data);
    self->connected_ = true;
    char address[IP4ADDR_STRLEN_MAX] = {};
    if (got_ip != nullptr && esp_ip4addr_ntoa(&got_ip->ip_info.ip, address, sizeof(address)) != nullptr) {
      self->station_ip_ = address;
    }
    ESP_LOGI(kTag, "Wi-Fi connected: %s", self->station_ip_.c_str());
  }
}

}  // namespace app::services
