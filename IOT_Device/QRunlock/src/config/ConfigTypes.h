#pragma once

#include <cstdint>

namespace config {

struct DeviceConfig {
  uint32_t schemaVersion;
  uint16_t relayPulseMs;
  uint16_t relayCooldownMs;
  uint8_t otaAllowDowngrade;
  char otaUrl[160];
};

struct NetworkConfig {
  uint8_t configured;
  char ssid[33];
  char password[65];
};

}  // namespace config
