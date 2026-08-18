#pragma once

#include <cstring>

#include "config/ConfigTypes.h"

namespace config {

inline constexpr uint32_t kSchemaVersion = 1;
inline constexpr uint16_t kMinRelayPulseMs = 300;
inline constexpr uint16_t kMaxRelayPulseMs = 300;
inline constexpr uint16_t kDefaultRelayPulseMs = 300;
inline constexpr uint16_t kDefaultRelayCooldownMs = 1500;
inline constexpr uint16_t kMaxRelayCooldownMs = 10000;
inline constexpr uint32_t kWifiConnectTimeoutMs = 30000;
inline constexpr uint32_t kWifiReconnectMs = 30000;
inline constexpr uint32_t kBleProvisionWindowMs = 180000;
inline constexpr uint32_t kRfValidHighMs = 40;
inline constexpr uint32_t kRfDebounceMs = 20;
inline constexpr uint32_t kRfDuplicateSuppressMs = 250;
inline constexpr uint32_t kRfLearnWindowMs = 10000;
inline constexpr uint32_t kRfLearnSettleMs = 250;

inline uint16_t ClampRelayPulseMs(uint16_t value) {
  if (value < kMinRelayPulseMs) return kMinRelayPulseMs;
  if (value > kMaxRelayPulseMs) return kMaxRelayPulseMs;
  return value;
}

inline uint16_t ClampRelayCooldownMs(uint16_t value) {
  if (value > kMaxRelayCooldownMs) return kMaxRelayCooldownMs;
  return value;
}

inline DeviceConfig DefaultDeviceConfig() {
  DeviceConfig config{};
  config.schemaVersion = kSchemaVersion;
  config.relayPulseMs = kDefaultRelayPulseMs;
  config.relayCooldownMs = kDefaultRelayCooldownMs;
  config.otaAllowDowngrade = 0;
  config.otaUrl[0] = '\0';
  return config;
}

inline NetworkConfig DefaultNetworkConfig() {
  NetworkConfig config{};
  config.configured = 0;
  config.ssid[0] = '\0';
  config.password[0] = '\0';
  return config;
}

inline DeviceConfig SanitizeDeviceConfig(DeviceConfig config) {
  config.schemaVersion = kSchemaVersion;
  config.relayPulseMs = ClampRelayPulseMs(config.relayPulseMs);
  config.relayCooldownMs = ClampRelayCooldownMs(config.relayCooldownMs);
  config.otaAllowDowngrade = config.otaAllowDowngrade ? 1 : 0;
  config.otaUrl[sizeof(config.otaUrl) - 1] = '\0';
  return config;
}

inline bool NetworkConfigEquals(const NetworkConfig& left, const NetworkConfig& right) {
  return std::memcmp(&left, &right, sizeof(NetworkConfig)) == 0;
}

inline bool DeviceConfigEquals(const DeviceConfig& left, const DeviceConfig& right) {
  return std::memcmp(&left, &right, sizeof(DeviceConfig)) == 0;
}

}  // namespace config
