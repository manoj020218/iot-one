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

// Binds this device to one Jenix One HOME and MQTT broker. `homeId` becomes
// the `tenantId` segment of the canonical jnx/{tenantId}/{pid}/{deviceId}/
// {suffix} topic scheme (packages/shared/src/utils/mqtt-topics.ts) — see
// BRIDGE.md. mqttUsername/mqttPassword remain only as a legacy compatibility
// fallback for older bench flows; new per-device broker auth belongs in
// MqttDeviceCredentialConfig below.
struct CloudConfig {
  uint32_t schemaVersion;
  uint8_t configured;
  char homeId[48];
  char mqttHost[64];
  uint16_t mqttPort;
  char mqttUsername[32];
  char mqttPassword[64];
};

enum class MqttDeviceCredentialSource : uint8_t {
  None = 0,
  Provisioned = 1,
  LocalApi = 2,
  ProvisioningSession = 3,
};

// Stores the actual MQTT username/password for this physical unit, separate
// from the HOME/broker binding above so per-device auth can be provisioned,
// rotated, and activated without overloading `/api/cloud`.
struct MqttDeviceCredentialConfig {
  uint32_t schemaVersion;
  uint8_t source;
  uint8_t useForCloudBroker;
  char username[32];
  char password[64];
};

enum class LocalAuthTokenSource : uint8_t {
  None = 0,
  Generated = 1,
  Provisioned = 2,
};

struct LocalAuthConfig {
  uint32_t schemaVersion;
  uint8_t tokenSource;
  char apiToken[65];
};

enum class ProvisioningPopSource : uint8_t {
  None = 0,
  Generated = 1,
  Provisioned = 2,
};

struct ProvisioningConfig {
  uint32_t schemaVersion;
  uint8_t popSource;
  char proofOfPossession[33];
};

}  // namespace config
