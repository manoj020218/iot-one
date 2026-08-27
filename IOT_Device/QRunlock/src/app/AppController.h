#pragma once

#include <ArduinoJson.h>

#include "app/AppState.h"
#include "button/ButtonService.h"
#include "cloud/CloudBridgeService.h"
#include "connectivity/BleProvisioningService.h"
#include "connectivity/WifiManager.h"
#include "device_identity/DeviceIdentity.h"
#include "ota/OtaService.h"
#include "platform/ControlApi.h"
#include "relay/RelayService.h"
#include "rf/RfService.h"
#include "status_led/StatusLedService.h"
#include "storage/ConfigStore.h"
#include "system/Logger.h"
#include "web/WebServerService.h"

namespace app {

class AppController : public platform::ControlApi {
 public:
  void Begin();
  void Tick();

  bool Unlock(const String& reason) override;
  bool StartRfLearning() override;
  void CancelRfLearning() override;
  void EnterProvisioning() override;
  bool ApplyWifi(const String& ssid, const String& password) override;
  void HandleProvisioningRequest(const JsonDocument& request,
                                 JsonDocument& response) override;
  bool AuthorizeLocalMutation(const String& token) const override;
  bool SaveSettings(uint16_t relayPulseMs, uint16_t relayCooldownMs,
                    const String& otaUrl) override;
  bool SaveCloudConfig(const String& homeId, bool homeIdProvided,
                       const String& mqttHost, bool mqttHostProvided,
                       uint16_t mqttPort, bool mqttPortProvided,
                       const String& mqttUsername, bool mqttUsernameProvided,
                       const String& mqttPassword,
                       bool mqttPasswordProvided) override;
  bool SaveDeviceMqttCredential(const String& mqttUsername,
                                bool mqttUsernameProvided,
                                const String& mqttPassword,
                                bool mqttPasswordProvided,
                                bool activateForCloudBroker,
                                bool activateProvided,
                                uint8_t credentialSource) override;
  bool RequestOta(const String& url, const String& targetVersion,
                  bool allowDowngrade) override;
  void Restart() override;
  void FactoryReset() override;
  void FillStatus(JsonDocument& doc) const override;

 private:
  void ClearWifiAndEnterProvisioning(const char* reason);
  void FillProvisioningHello(JsonObject object) const;
  void HandleButton(button::ButtonEvent event);
  void HandleRfEvent(const rf::RfEvent& event);
  void HandleDeferredRestart(uint32_t nowMs);
  static bool FixedTimeTokenEquals(const char* expected, const String& actual);

  systemlog::Logger logger_{};
  identity::DeviceIdentity identity_{};
  storage::ConfigStore store_{};
  relay::RelayService relay_{logger_};
  rf::RfService rf_{logger_};
  connectivity::WifiManager wifi_{store_, identity_, logger_};
  connectivity::BleProvisioningService ble_{store_, logger_};
  ota::OtaService ota_{logger_};
  cloud::CloudBridgeService cloud_{store_, identity_, logger_};
  statusled::StatusLedService led_{};
  button::ButtonService button_{};
  web::WebServerService web_{};
  uint32_t bleWindowExpiresAtMs_ = 0;
  uint32_t restartAtMs_ = 0;
  bool taskWatchdogActive_ = false;
  bool factoryResetPending_ = false;
  bool lastApActive_ = false;
  AppState state_ = AppState::Boot;
  // ESP.getSketchSize()/getFreeSketchSpace() run a full esp_image_verify()
  // flash checksum internally. Cache once at boot instead of recomputing on
  // every /api/status hit (these never change while the app is running).
  uint32_t sketchSizeBytes_ = 0;
  uint32_t freeSketchSpaceBytes_ = 0;
};

}  // namespace app
