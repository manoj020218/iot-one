#pragma once

#include <string>
#include <vector>

#include <Arduino.h>
#include <ArduinoJson.h>

#ifdef JENIX_PROV_V2
#include <esp_event.h>
#endif

#include "connectivity/WifiManager.h"
#include "storage/ConfigStore.h"
#include "device_identity/DeviceIdentity.h"
#include "platform/ControlApi.h"
#include "system/Logger.h"

namespace connectivity {

class BleProvisioningService {
 public:
  BleProvisioningService(storage::ConfigStore& store, systemlog::Logger& logger)
      : store_(store), logger_(logger) {}

  void AttachApi(platform::ControlApi& api) { api_ = &api; }
  bool Begin(const identity::DeviceIdentity& identity);
  void Stop();
  void FillJson(JsonObject object) const;
  bool Started() const { return started_; }
  void ApplyPayload(const std::string& payload);
#ifdef JENIX_PROV_V2
  void HandleEvent(esp_event_base_t eventBase, int32_t eventId, void* eventData);
#endif

 private:
#ifdef JENIX_PROV_V2
  void EnsureSec2Material();
  void HandleProvEvent(int32_t eventId, void* eventData);
  void HandleWifiEvent(int32_t eventId, void* eventData);
  void HandleIpEvent(int32_t eventId, void* eventData);
  void HandleBleTransportEvent(int32_t eventId, void* eventData);
  void HandleSecurityEvent(int32_t eventId, void* eventData);
  void PrintProvisioningPayload(const identity::DeviceIdentity& identity) const;
#endif

  platform::ControlApi* api_ = nullptr;
  storage::ConfigStore& store_;
  systemlog::Logger& logger_;
  bool initialized_ = false;
  bool started_ = false;
  bool eventHandlersRegistered_ = false;
  String lastStatus_ = "idle";
  String lastMessage_;
#ifdef JENIX_PROV_V2
  String serviceName_;
  String lastProvisionedSsid_;
  String lastIp_;
  String lastFailureReason_;
  std::vector<char> sec2Salt_;
  std::vector<char> sec2Verifier_;
#endif
};

}  // namespace connectivity
