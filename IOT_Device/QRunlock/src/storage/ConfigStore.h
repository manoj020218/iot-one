#pragma once

#include <Arduino.h>
#include <Preferences.h>

#include "config/ConfigTypes.h"

namespace storage {

class ConfigStore {
 public:
  bool Begin();

  const config::DeviceConfig& Device() const { return deviceConfig_; }
  const config::NetworkConfig& Network() const { return networkConfig_; }
  const config::CloudConfig& Cloud() const { return cloudConfig_; }

  bool SaveDevice(const config::DeviceConfig& config);
  bool SaveNetwork(const String& ssid, const String& password);
  bool SaveCloud(const config::CloudConfig& config);
  void FactoryReset();

 private:
  void LoadDevice();
  void LoadNetwork();
  void LoadCloud();

  config::DeviceConfig deviceConfig_{};
  config::NetworkConfig networkConfig_{};
  config::CloudConfig cloudConfig_{};
};

}  // namespace storage
