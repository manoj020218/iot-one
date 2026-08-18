#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <WiFi.h>

#include "device_identity/DeviceIdentity.h"
#include "storage/ConfigStore.h"
#include "system/Logger.h"

namespace connectivity {

class WifiManager {
 public:
  WifiManager(storage::ConfigStore& store, identity::DeviceIdentity& identity,
              systemlog::Logger& logger)
      : store_(store), identity_(identity), logger_(logger) {}

  void Begin();
  void Tick(uint32_t nowMs);
  bool SaveAndReconnect(const String& ssid, const String& password);
  bool ClearSavedNetwork();
  void StartProvisioningAp(bool sticky = true, bool forceRestart = true);
  bool Connected() const;
  bool AccessPointActive() const { return apActive_; }
  String LocalIp() const;
  String StationSsid() const;
  void FillJson(JsonObject object) const;

 private:
  void StartStation(bool keepRecoveryAp);
  void StopProvisioningAp();

  storage::ConfigStore& store_;
  identity::DeviceIdentity& identity_;
  systemlog::Logger& logger_;
  uint32_t connectStartedAtMs_ = 0;
  bool apActive_ = false;
  bool stickyAp_ = false;
  bool lastConnected_ = false;
};

}  // namespace connectivity
