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
// BRIDGE.md. mqttUsername/mqttPassword are optional (empty = anonymous
// connect); today's broker runs open, but the fields exist so a future
// per-device-credential rollout (MQTT_LICENSED_DEVICE_ACCESS_PLAN.md) is a
// config change here, not a firmware rebuild.
struct CloudConfig {
  uint32_t schemaVersion;
  uint8_t configured;
  char homeId[48];
  char mqttHost[64];
  uint16_t mqttPort;
  char mqttUsername[32];
  char mqttPassword[64];
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
