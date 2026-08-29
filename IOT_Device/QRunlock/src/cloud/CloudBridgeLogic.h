#pragma once

#include <cstdint>
#include <cstdio>
#include <cstring>

// Pure, hardware-free logic for the Jenix One MQTT bridge — no Arduino.h,
// no ArduinoJson, no network I/O, so it builds and unit-tests under the
// `native` PlatformIO env exactly like RelayLogic/RfLogic/ButtonLogic do.
// CloudBridgeService (cloud/CloudBridgeService.h) owns the actual
// PubSubClient connection and calls into this for topic strings and
// command classification. See BRIDGE.md for the full protocol writeup —
// this file is deliberately the one place that protocol is encoded, so a
// future device copies this header, changes nothing but the command
// vocabulary, and gets the same topic scheme for free.

namespace cloud {

// Canonical device topic scheme (frozen platform-wide — mirrors
// packages/shared/src/utils/mqtt-topics.ts buildDeviceTopic exactly):
//   jnx/{tenantId}/{pid}/{deviceId}/{suffix}
// tenantId is always the owning Jenix HOME's id. Returns the number of
// characters written (excluding the null terminator), or a negative value
// if `out` was too small — same contract as std::snprintf.
inline int BuildTopic(char* out, size_t outSize, const char* tenantId, const char* pid,
                      const char* deviceId, const char* suffix) {
  return std::snprintf(out, outSize, "jnx/%s/%s/%s/%s", tenantId, pid, deviceId, suffix);
}

// The command names this device's cloud bridge understands. Extend this
// enum (and the mapping in ParseCommandKind) when a device needs more than
// one remote command — QRunlock only ever needs one, by hardware design
// (see ProductIdentity.h's kProductLine).
enum class CommandKind : uint8_t {
  Unknown = 0,
  Unlock,
  RfLearnStart,
  RfLearnCancel,
};

inline CommandKind ParseCommandKind(const char* command) {
  if (command == nullptr || command[0] == '\0') return CommandKind::Unknown;
  if (std::strcmp(command, "unlock") == 0) return CommandKind::Unlock;
  if (std::strcmp(command, "rf_learn_start") == 0) return CommandKind::RfLearnStart;
  if (std::strcmp(command, "rf_learn_cancel") == 0) return CommandKind::RfLearnCancel;
  return CommandKind::Unknown;
}

}  // namespace cloud
