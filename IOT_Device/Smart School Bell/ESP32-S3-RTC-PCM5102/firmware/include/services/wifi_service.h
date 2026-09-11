#pragma once

#include <string>

#include "app_types.h"
#include "esp_err.h"
#include "esp_event_base.h"

namespace app::services {

class WifiService {
 public:
  void setMdnsHostname(const std::string& hostname) { mdns_hostname_ = hostname; }
  esp_err_t init(const DeviceConfig& config);
  esp_err_t applyStationConfig(const std::string& ssid, const std::string& password);
  void tick();
  bool isReady() const { return ap_started_ || connected_; }
  bool isConnected() const { return connected_; }
  bool isApStarted() const { return ap_started_; }
  bool hasStationConfig() const { return station_configured_; }
  const char* apSsid() const;
  const std::string& activeSsid() const { return active_ssid_; }
  const std::string& stationIp() const { return station_ip_; }
  const std::string& mdnsHostname() const { return mdns_hostname_; }

 private:
  static void eventHandler(void* arg, esp_event_base_t event_base, int32_t event_id, void* event_data);
  esp_err_t loadSavedStation(std::string* ssid, std::string* password) const;
  esp_err_t saveStation(const std::string& ssid, const std::string& password) const;

  bool stack_ready_ = false;
  bool ap_started_ = false;
  bool station_configured_ = false;
  bool connected_ = false;
  std::string active_ssid_;
  std::string station_ip_;
  std::string mdns_hostname_;
};

}  // namespace app::services
