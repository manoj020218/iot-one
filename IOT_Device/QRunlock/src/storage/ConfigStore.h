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

  bool SaveDevice(const config::DeviceConfig& config);
  bool SaveNetwork(const String& ssid, const String& password);
  void FactoryReset();

 private:
  void LoadDevice();
  void LoadNetwork();

  config::DeviceConfig deviceConfig_{};
  config::NetworkConfig networkConfig_{};
};

}  // namespace storage
