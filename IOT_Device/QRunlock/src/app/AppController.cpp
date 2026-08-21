#include "app/AppController.h"

#include <cstring>

#include <esp_system.h>
#include <esp_task_wdt.h>

#include "app/ProductIdentity.h"
#include "board/PinConfig.h"
#include "config/Defaults.h"

namespace app {
namespace {

const char* ResetReasonString() {
  switch (esp_reset_reason()) {
    case ESP_RST_POWERON: return "POWERON";
    case ESP_RST_SW: return "SW";
    case ESP_RST_PANIC: return "PANIC";
    case ESP_RST_INT_WDT: return "INT_WDT";
    case ESP_RST_TASK_WDT: return "TASK_WDT";
    case ESP_RST_BROWNOUT: return "BROWNOUT";
    default: return "OTHER";
  }
}

void ArmBleProvisionWindow(uint32_t nowMs, uint32_t* expiresAtMs) {
  *expiresAtMs = nowMs + config::kBleProvisionWindowMs;
}

const char* TokenSourceString(uint8_t tokenSource) {
  switch (static_cast<config::LocalAuthTokenSource>(tokenSource)) {
    case config::LocalAuthTokenSource::Generated: return "generated";
    case config::LocalAuthTokenSource::Provisioned: return "provisioned";
    default: return "missing";
  }
}

const char* PopSourceString(uint8_t popSource) {
  switch (static_cast<config::ProvisioningPopSource>(popSource)) {
    case config::ProvisioningPopSource::Generated: return "generated";
    case config::ProvisioningPopSource::Provisioned: return "provisioned";
    default: return "missing";
  }
}

}  // namespace

void AppController::Begin() {
  setCpuFrequencyMhz(80);
  Serial.begin(115200);
  delay(50);
  identity_.Begin();
  store_.Begin();
  const esp_err_t initWatchdogResult =
      esp_task_wdt_init(config::kTaskWatchdogTimeoutSec, true);
  if (initWatchdogResult == ESP_OK || initWatchdogResult == ESP_ERR_INVALID_STATE) {
    const esp_err_t watchdogStatus = esp_task_wdt_status(nullptr);
    if (watchdogStatus == ESP_OK) {
      taskWatchdogActive_ = true;
    } else if (watchdogStatus == ESP_ERR_NOT_FOUND) {
      const esp_err_t addWatchdogResult = esp_task_wdt_add(nullptr);
      taskWatchdogActive_ = addWatchdogResult == ESP_OK;
      if (!taskWatchdogActive_) {
        logger_.Error(String("Task watchdog subscribe failed err=") + addWatchdogResult);
      }
    } else {
      logger_.Error(String("Task watchdog status failed err=") + watchdogStatus);
    }
  } else {
    logger_.Error(String("Task watchdog init failed err=") + initWatchdogResult);
  }
  bool generatedLocalApiToken = false;
  store_.EnsureLocalApiToken(&generatedLocalApiToken);
  if (generatedLocalApiToken) {
    Serial.printf("[SECURITY] Generated local API token header %s value %s\r\n",
                  config::kLocalApiAuthHeaderName, store_.LocalAuth().apiToken);
  } else {
    Serial.printf("[SECURITY] Local API token source=%s header=%s\r\n",
                  TokenSourceString(store_.LocalAuth().tokenSource),
                  config::kLocalApiAuthHeaderName);
  }
  bool generatedProvisioningPop = false;
  store_.EnsureProvisioningPop(&generatedProvisioningPop);
  Serial.printf("[PROVISIONING] Security2 username %s PoP source=%s value=%s\r\n",
                config::kProvisioningSec2Username,
                PopSourceString(store_.Provisioning().popSource),
                store_.Provisioning().proofOfPossession);
  if (generatedProvisioningPop) {
    Serial.println("[PROVISIONING] Generated new per-device Proof-of-Possession");
  }
  relay_.Begin(board::kRelayPin, board::kRelayActiveHigh, store_.Device().relayPulseMs,
               store_.Device().relayCooldownMs);
  led_.Begin(board::kStatusLedPin, board::kLedActiveHigh);
  button_.Begin(board::kButtonPin, board::kButtonActiveLow);
  rf_.Begin(board::kRfLinePin, config::kRfDebounceMs, config::kRfValidHighMs,
            config::kRfDuplicateSuppressMs, config::kRfLearnWindowMs,
            config::kRfLearnSettleMs);
  ble_.AttachApi(*this);
  wifi_.Begin();
  if (app::kBleProvisioningEnabled && wifi_.AccessPointActive() &&
      !store_.Network().configured) {
    ArmBleProvisionWindow(millis(), &bleWindowExpiresAtMs_);
    ble_.Begin(identity_);
    lastApActive_ = true;
  }
  web_.Begin(*this);
  cloud_.Begin(*this);
  logger_.Info(String("Boot PID=") + app::kPid + " AP/BLE=" + identity_.BleName() +
               " CPU=" + getCpuFrequencyMhz() + "MHz");
}

void AppController::Tick() {
  const uint32_t nowMs = millis();
  wifi_.Tick(nowMs);
  const bool apActive = wifi_.AccessPointActive();
  if (app::kBleProvisioningEnabled) {
    if (apActive && !lastApActive_ && !store_.Network().configured) {
      ArmBleProvisionWindow(nowMs, &bleWindowExpiresAtMs_);
      ble_.Begin(identity_);
    } else if (!apActive && lastApActive_) {
      bleWindowExpiresAtMs_ = 0;
      ble_.Stop();
    } else if (apActive && bleWindowExpiresAtMs_ != 0 && nowMs >= bleWindowExpiresAtMs_) {
      ble_.Stop();
    }
  }
  lastApActive_ = apActive;
  ota_.Tick();
  relay_.Tick(nowMs);
  cloud_.Tick(nowMs, wifi_.Connected());
  HandleButton(button_.Tick(nowMs));
  HandleRfEvent(rf_.Tick(nowMs));
  HandleDeferredRestart(nowMs);
  state_ = ResolveState({nowMs, wifi_.AccessPointActive(), ble_.Started(),
                         wifi_.Connected(), cloud_.Connected(), rf_.LearningActive(),
                         ota_.Active(), ota_.HasError()});
  led_.SetState(state_);
  led_.Tick(nowMs);
  web_.Tick();
  if (taskWatchdogActive_) esp_task_wdt_reset();
}

bool AppController::Unlock(const String& reason) {
  if (ota_.Active()) return false;
  const uint32_t nowMs = millis();
  if (!relay_.Pulse(nowMs, reason)) return false;
  led_.RequestRelayTriggerFlash(nowMs);
  return true;
}

bool AppController::StartRfLearning() {
  if (ota_.Active()) return false;
  led_.ClearRfLearnQuietHold();
  return rf_.StartLearning(millis());
}
void AppController::CancelRfLearning() { rf_.CancelLearning(); }
void AppController::EnterProvisioning() {
  wifi_.StartProvisioningAp(true);
  if (app::kBleProvisioningEnabled) {
    ArmBleProvisionWindow(millis(), &bleWindowExpiresAtMs_);
    ble_.Begin(identity_);
  }
}
bool AppController::ApplyWifi(const String& ssid, const String& password) {
  return wifi_.SaveAndReconnect(ssid, password);
}

bool AppController::AuthorizeLocalMutation(const String& token) const {
  return FixedTimeTokenEquals(store_.LocalAuth().apiToken, token);
}

void AppController::HandleProvisioningRequest(const JsonDocument& request,
                                              JsonDocument& response) {
  const String cmd = request["cmd"] | "";
  JsonObject payload = response.to<JsonObject>();

  if (cmd.isEmpty() || cmd == "hello") {
    FillProvisioningHello(payload);
    return;
  }

  if (cmd == "set_wifi") {
    const String ssid = request["ssid"].is<const char*>()
                            ? request["ssid"].as<const char*>()
                            : (request["wifiSsid"] | "");
    const String password = request["password"].is<const char*>()
                                ? request["password"].as<const char*>()
                                : (request["wifiPassword"] | "");
    if (ssid.isEmpty()) {
      payload["ok"] = false;
      payload["error"] = "ssid_required";
      return;
    }
    if (!ApplyWifi(ssid, password)) {
      payload["ok"] = false;
      payload["error"] = "wifi_save_failed";
      return;
    }
    payload["ok"] = true;
    payload["cmd"] = "set_wifi";
    payload["wifi_connected"] = wifi_.Connected();
    if (wifi_.Connected()) payload["ip"] = wifi_.LocalIp();
    return;
  }

  if (cmd == "c" || cmd == "cloud_status") {
    payload["ok"] = true;
    payload["cmd"] = "c";
    payload["wifi_connected"] = wifi_.Connected();
    payload["mqtt_connected"] = cloud_.Connected();
    return;
  }

  if (cmd == "clear_wifi" || (request["clearWifi"] | false) ||
      (request["apRecovery"] | false)) {
    ClearWifiAndEnterProvisioning("provisioning_protocol");
    payload["ok"] = true;
    payload["cmd"] = "clear_wifi";
    payload["wifi_connected"] = false;
    return;
  }

  payload["ok"] = false;
  payload["error"] = "unsupported_cmd";
}

bool AppController::SaveSettings(uint16_t relayPulseMs, uint16_t relayCooldownMs,
                                 const String& otaUrl) {
  config::DeviceConfig config = store_.Device();
  config.relayPulseMs = config::ClampRelayPulseMs(relayPulseMs);
  config.relayCooldownMs = config::ClampRelayCooldownMs(relayCooldownMs);
  otaUrl.substring(0, sizeof(config.otaUrl) - 1).toCharArray(config.otaUrl,
                                                              sizeof(config.otaUrl));
  if (!store_.SaveDevice(config)) return false;
  relay_.Configure(config.relayPulseMs, config.relayCooldownMs);
  return true;
}

bool AppController::SaveCloudConfig(const String& homeId, bool homeIdProvided,
                                    const String& mqttHost, bool mqttHostProvided,
                                    uint16_t mqttPort, bool mqttPortProvided,
                                    const String& mqttUsername, bool mqttUsernameProvided,
                                    const String& mqttPassword,
                                    bool mqttPasswordProvided) {
  config::CloudConfig config = store_.Cloud();
  if (homeIdProvided) {
    homeId.substring(0, sizeof(config.homeId) - 1)
        .toCharArray(config.homeId, sizeof(config.homeId));
  }
  if (mqttHostProvided) {
    mqttHost.substring(0, sizeof(config.mqttHost) - 1)
        .toCharArray(config.mqttHost, sizeof(config.mqttHost));
  }
  if (mqttPortProvided) config.mqttPort = mqttPort;
  if (mqttUsernameProvided) {
    mqttUsername.substring(0, sizeof(config.mqttUsername) - 1)
        .toCharArray(config.mqttUsername, sizeof(config.mqttUsername));
  }
  if (mqttPasswordProvided) {
    mqttPassword.substring(0, sizeof(config.mqttPassword) - 1)
        .toCharArray(config.mqttPassword, sizeof(config.mqttPassword));
  }
  if (!store_.SaveCloud(config)) return false;
  cloud_.ApplyConfig();
  return true;
}

bool AppController::RequestOta(const String& url, const String& targetVersion,
                               bool allowDowngrade) {
  const String resolved = url.isEmpty() ? String(store_.Device().otaUrl) : url;
  return wifi_.Connected() &&
         ota_.RequestInstall(resolved, targetVersion,
                             allowDowngrade || store_.Device().otaAllowDowngrade != 0);
}

void AppController::Restart() { restartAtMs_ = millis() + 500; }
void AppController::FactoryReset() {
  factoryResetPending_ = true;
  restartAtMs_ = millis() + 500;
}

void AppController::ClearWifiAndEnterProvisioning(const char* reason) {
  logger_.Warn(String("Clearing saved Wi-Fi and entering provisioning: ") + reason);
  led_.ClearRfLearnQuietHold();
  rf_.CancelLearning();
  if (!wifi_.ClearSavedNetwork()) {
    logger_.Error("Failed to clear saved Wi-Fi credentials");
    return;
  }
  if (app::kBleProvisioningEnabled) {
    ArmBleProvisionWindow(millis(), &bleWindowExpiresAtMs_);
    ble_.Begin(identity_);
  }
}

void AppController::FillProvisioningHello(JsonObject object) const {
  object["ok"] = true;
  object["cmd"] = "hello";
  object["device_id"] = identity_.DeviceId();
  object["pid"] = app::kPid;
  object["product_name"] = app::kProductName;
  object["ble_name"] = identity_.BleName();
  object["ap_ssid"] = identity_.ApSsid();
  object["wifi_connected"] = wifi_.Connected();
  if (wifi_.Connected()) object["ssid"] = wifi_.StationSsid();
  const String ip = wifi_.LocalIp();
  if (!ip.isEmpty()) object["ip"] = ip;
  object["firmware_version"] = app::kFirmwareVersion;
  object["hardware_revision"] = app::kHardwareRevision;
  object["matter_enabled"] = app::kMatterEnabled;
}

void AppController::FillStatus(JsonDocument& doc) const {
  doc["state"] = ToString(state_);
  JsonObject device = doc.createNestedObject("device");
  device["pid"] = app::kPid;
  device["model"] = app::kModel;
  device["productCategory"] = app::kProductCategory;
  device["productLine"] = app::kProductLine;
  device["hardwareRevision"] = app::kHardwareRevision;
  device["firmwareVersion"] = app::kFirmwareVersion;
  device["buildId"] = app::kBuildId;
  device["deviceId"] = identity_.DeviceId();
  device["hardwareId"] = identity_.HardwareId();
  device["bleName"] = identity_.BleName();
  device["apSsid"] = identity_.ApSsid();
  device["mdnsHost"] = identity_.MdnsHost();
  JsonObject system = doc.createNestedObject("system");
  system["uptimeMs"] = millis();
  system["resetReason"] = ResetReasonString();
  system["freeHeap"] = ESP.getFreeHeap();
  system["minFreeHeap"] = ESP.getMinFreeHeap();
  system["sketchSize"] = ESP.getSketchSize();
  system["freeSketchSpace"] = ESP.getFreeSketchSpace();
  system["cpuFreqMHz"] = getCpuFrequencyMhz();
  system["bleProvisionWindowRemainingMs"] =
      (app::kBleProvisioningEnabled && wifi_.AccessPointActive() &&
       bleWindowExpiresAtMs_ > millis())
          ? (bleWindowExpiresAtMs_ - millis())
          : 0;
  JsonObject localApiAuth = doc.createNestedObject("localApiAuth");
  localApiAuth["configured"] = store_.LocalAuth().apiToken[0] != '\0';
  localApiAuth["headerName"] = config::kLocalApiAuthHeaderName;
  localApiAuth["source"] = TokenSourceString(store_.LocalAuth().tokenSource);
  JsonObject provisioning = doc.createNestedObject("provisioning");
  provisioning["serviceName"] = identity_.BleName();
  provisioning["security"] = "scheme2_ready";
  provisioning["username"] = config::kProvisioningSec2Username;
  provisioning["proofOfPossessionConfigured"] =
      store_.Provisioning().proofOfPossession[0] != '\0';
  provisioning["proofOfPossessionSource"] =
      PopSourceString(store_.Provisioning().popSource);
#ifdef JENIX_PROV_V2
  provisioning["pilotBuild"] = true;
#else
  provisioning["pilotBuild"] = false;
#endif
  wifi_.FillJson(doc.createNestedObject("wifi"));
  cloud_.FillJson(doc.createNestedObject("cloud"));
  relay_.FillJson(doc.createNestedObject("relay"));
  rf_.FillJson(doc.createNestedObject("rf"), millis());
  ble_.FillJson(doc.createNestedObject("ble"));
  ota_.FillJson(doc.createNestedObject("ota"));
  led_.FillJson(doc.createNestedObject("led"));
  JsonArray logs = doc.createNestedArray("logs");
  logger_.FillJson(logs);
}

void AppController::HandleButton(button::ButtonEvent event) {
  if (event == button::ButtonEvent::ShortPress) {
    Unlock(relay_.StateOn() ? "button_toggle_off" : "button_toggle_on");
  }
  if (event == button::ButtonEvent::RfLearnMultiPress) {
    if (!StartRfLearning()) logger_.Warn("Button RF learn request ignored");
  }
  if (event == button::ButtonEvent::FactoryResetMultiPress) {
    ClearWifiAndEnterProvisioning("button_10_click");
  }
  if (event == button::ButtonEvent::FactoryResetHold) {
    ClearWifiAndEnterProvisioning("button_30s_hold");
  }
}

void AppController::HandleRfEvent(const rf::RfEvent& event) {
  if (event.type == rf::RfEventType::Triggered) Unlock("rf_vt");
  if (event.type == rf::RfEventType::LearningSuccess) {
    led_.RequestRfLearnQuietHold(millis());
  }
}

void AppController::HandleDeferredRestart(uint32_t nowMs) {
  if (restartAtMs_ == 0 || nowMs < restartAtMs_) return;
  if (factoryResetPending_) store_.FactoryReset();
  ESP.restart();
}

bool AppController::FixedTimeTokenEquals(const char* expected, const String& actual) {
  const size_t expectedLength = std::strlen(expected);
  const size_t actualLength = actual.length();
  if (expectedLength == 0 || expectedLength != actualLength) return false;
  uint8_t diff = 0;
  for (size_t index = 0; index < expectedLength; ++index) {
    diff |= static_cast<uint8_t>(expected[index] ^ actual[index]);
  }
  return diff == 0;
}

}  // namespace app
