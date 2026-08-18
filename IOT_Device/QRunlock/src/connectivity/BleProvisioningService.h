#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

#include "connectivity/WifiManager.h"
#include "device_identity/DeviceIdentity.h"
#include "system/Logger.h"

namespace connectivity {

class BleProvisioningService {
 public:
  BleProvisioningService(WifiManager& wifiManager, systemlog::Logger& logger)
      : wifiManager_(wifiManager), logger_(logger) {}

  bool Begin(const identity::DeviceIdentity& identity);
  void Stop();
  void FillJson(JsonObject object) const;
  bool Started() const { return started_; }
  void ApplyPayload(const std::string& payload);

 private:
  WifiManager& wifiManager_;
  systemlog::Logger& logger_;
  bool initialized_ = false;
  bool started_ = false;
  String lastStatus_ = "idle";
  String lastMessage_;
};

}  // namespace connectivity
