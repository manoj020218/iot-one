#pragma once

#include <string>

#include "esp_err.h"

namespace app::services {

class DeviceIdentityService {
 public:
  esp_err_t init();

  const std::string& deviceId() const { return device_id_; }
  const std::string& hardwareId() const { return hardware_id_; }
  const std::string& macSuffix() const { return mac_suffix_; }
  const std::string& mdnsHostname() const { return mdns_hostname_; }

 private:
  std::string device_id_;
  std::string hardware_id_;
  std::string mac_suffix_;
  std::string mdns_hostname_;
};

}  // namespace app::services
