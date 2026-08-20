#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

#include "connectivity/WifiManager.h"
#include "device_identity/DeviceIdentity.h"
#include "platform/ControlApi.h"
#include "system/Logger.h"

namespace connectivity {

class BleProvisioningService {
 public:
  explicit BleProvisioningService(systemlog::Logger& logger) : logger_(logger) {}

  void AttachApi(platform::ControlApi& api) { api_ = &api; }
  bool Begin(const identity::DeviceIdentity& identity);
  void Stop();
  void FillJson(JsonObject object) const;
  bool Started() const { return started_; }
  void ApplyPayload(const std::string& payload);

 private:
  platform::ControlApi* api_ = nullptr;
  systemlog::Logger& logger_;
  bool initialized_ = false;
  bool started_ = false;
  String lastStatus_ = "idle";
  String lastMessage_;
};

}  // namespace connectivity
