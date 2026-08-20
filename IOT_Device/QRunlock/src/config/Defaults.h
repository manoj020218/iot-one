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
// Production Jenix One MQTT broker (DEVICE_INTEGRATION_GUIDE.md "MQTT
// Contract" — stable DNS name, not a raw VPS IP, so the broker can move
// without reflashing devices).
inline constexpr char kDefaultMqttHost[] = "mqtt.iotsoft.in";
inline constexpr uint16_t kDefaultMqttPort = 1883;
inline constexpr uint32_t kMqttReconnectMs = 5000;
// The broker's acl_file only reliably grants PUBLISH to a named "user"
// block — a plain anonymous connection can subscribe fine but every
// publish (this device's own status/ack, or a command sent to it) gets
// silently denied. Found and fixed live 2026-08-20 (see BRIDGE.md §4) —
// default to the shared platform credential so a future device copying
// this file doesn't rediscover the same silent failure. password_file is
// disabled on this listener, so the password value has no real secrecy
// function yet; the username is what the ACL actually matches on.
inline constexpr char kDefaultMqttUsername[] = "jenix_platform";

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

inline CloudConfig DefaultCloudConfig() {
  CloudConfig config{};
  config.schemaVersion = kSchemaVersion;
  config.configured = 0;
  config.homeId[0] = '\0';
  std::strncpy(config.mqttHost, kDefaultMqttHost, sizeof(config.mqttHost) - 1);
  config.mqttPort = kDefaultMqttPort;
  std::strncpy(config.mqttUsername, kDefaultMqttUsername, sizeof(config.mqttUsername) - 1);
  config.mqttPassword[0] = '\0';
  return config;
}

inline CloudConfig SanitizeCloudConfig(CloudConfig config) {
  config.schemaVersion = kSchemaVersion;
  config.configured = config.homeId[0] != '\0' ? 1 : 0;
  config.homeId[sizeof(config.homeId) - 1] = '\0';
  if (config.mqttHost[0] == '\0') {
    std::strncpy(config.mqttHost, kDefaultMqttHost, sizeof(config.mqttHost) - 1);
  }
  config.mqttHost[sizeof(config.mqttHost) - 1] = '\0';
  if (config.mqttPort == 0) config.mqttPort = kDefaultMqttPort;
  config.mqttUsername[sizeof(config.mqttUsername) - 1] = '\0';
  config.mqttPassword[sizeof(config.mqttPassword) - 1] = '\0';
  return config;
}

inline bool CloudConfigEquals(const CloudConfig& left, const CloudConfig& right) {
  return std::memcmp(&left, &right, sizeof(CloudConfig)) == 0;
}

}  // namespace config
