#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

namespace platform {

class ControlApi {
 public:
  virtual ~ControlApi() = default;
  virtual bool Unlock(const String& reason) = 0;
  virtual bool StartRfLearning() = 0;
  virtual void CancelRfLearning() = 0;
  virtual void EnterProvisioning() = 0;
  virtual bool ApplyWifi(const String& ssid, const String& password) = 0;
  virtual void HandleProvisioningRequest(const JsonDocument& request,
                                         JsonDocument& response) = 0;
  virtual bool AuthorizeLocalMutation(const String& token) const = 0;
  virtual bool SaveSettings(uint16_t relayPulseMs, uint16_t relayCooldownMs,
                            const String& otaUrl) = 0;
  // Binds this device to a Jenix One HOME + MQTT broker (see BRIDGE.md).
  // mqttHost/mqttPort/mqttUsername/mqttPassword may be empty — empty host
  // falls back to the platform default, empty username means anonymous
  // connect.
  virtual bool SaveCloudConfig(const String& homeId, bool homeIdProvided,
                               const String& mqttHost, bool mqttHostProvided,
                               uint16_t mqttPort, bool mqttPortProvided,
                               const String& mqttUsername,
                               bool mqttUsernameProvided,
                               const String& mqttPassword,
                               bool mqttPasswordProvided) = 0;
  virtual bool RequestOta(const String& url, const String& targetVersion,
                          bool allowDowngrade) = 0;
  virtual void Restart() = 0;
  virtual void FactoryReset() = 0;
  virtual void FillStatus(JsonDocument& doc) const = 0;
};

}  // namespace platform
