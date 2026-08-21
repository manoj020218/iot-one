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
inline constexpr uint32_t kTaskWatchdogTimeoutSec = 20;
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
// silently denied. Found and fixed live 2026-08-20 (see BRIDGE.md §4).
// This is a SHARED credential (password_file is disabled on this listener,
// so the password value has no real secrecy function — only the username
// is checked), not a real per-device credential. It's a stand-in default so
// a fresh/factory-reset device doesn't silently regress into the anonymous-
// publish-denied failure mode with zero warning — replace with a real
// per-device MQTT credential once the platform can issue one (see the
// per-device Proof-of-Possession pattern below for the shape this should
// eventually take).
inline constexpr char kDefaultMqttUsername[] = "jenix_platform";
inline constexpr char kLocalApiAuthHeaderName[] = "X-Jenix-Local-Token";
inline constexpr size_t kLocalApiTokenBytes = 16;
inline constexpr char kProvisioningSec2Username[] = "wifiprov";
inline constexpr size_t kProvisioningPopBytes = 12;

#ifdef JNX_LOCAL_API_TOKEN
inline constexpr char kProvisionedLocalApiToken[] = JNX_LOCAL_API_TOKEN;
#else
inline constexpr char kProvisionedLocalApiToken[] = "";
#endif

#ifdef JNX_PROVISIONING_POP
inline constexpr char kProvisionedProofOfPossession[] = JNX_PROVISIONING_POP;
#else
inline constexpr char kProvisionedProofOfPossession[] = "";
#endif

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

inline LocalAuthConfig DefaultLocalAuthConfig() {
  LocalAuthConfig config{};
  config.schemaVersion = kSchemaVersion;
  config.tokenSource = static_cast<uint8_t>(LocalAuthTokenSource::None);
  config.apiToken[0] = '\0';
  return config;
}

inline LocalAuthConfig SanitizeLocalAuthConfig(LocalAuthConfig config) {
  config.schemaVersion = kSchemaVersion;
  config.apiToken[sizeof(config.apiToken) - 1] = '\0';
  if (config.apiToken[0] == '\0') {
    config.tokenSource = static_cast<uint8_t>(LocalAuthTokenSource::None);
  }
  return config;
}

inline bool LocalAuthConfigEquals(const LocalAuthConfig& left,
                                  const LocalAuthConfig& right) {
  return std::memcmp(&left, &right, sizeof(LocalAuthConfig)) == 0;
}

inline ProvisioningConfig DefaultProvisioningConfig() {
  ProvisioningConfig config{};
  config.schemaVersion = kSchemaVersion;
  config.popSource = static_cast<uint8_t>(ProvisioningPopSource::None);
  config.proofOfPossession[0] = '\0';
  return config;
}

inline ProvisioningConfig SanitizeProvisioningConfig(ProvisioningConfig config) {
  config.schemaVersion = kSchemaVersion;
  config.proofOfPossession[sizeof(config.proofOfPossession) - 1] = '\0';
  if (config.proofOfPossession[0] == '\0') {
    config.popSource = static_cast<uint8_t>(ProvisioningPopSource::None);
  }
  return config;
}

inline bool ProvisioningConfigEquals(const ProvisioningConfig& left,
                                     const ProvisioningConfig& right) {
  return std::memcmp(&left, &right, sizeof(ProvisioningConfig)) == 0;
}

}  // namespace config
