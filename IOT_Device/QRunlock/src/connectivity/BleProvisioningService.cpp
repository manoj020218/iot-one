#include "connectivity/BleProvisioningService.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>

#include <esp_event.h>
#include <esp_netif.h>
#include <esp_wifi.h>

#ifdef JENIX_PROV_V2
#include <protocomm_ble.h>
#include <protocomm_security.h>
#include <wifi_provisioning/manager.h>
#include <wifi_provisioning/scheme_ble.h>
#include <esp_srp.h>
#else
#include <NimBLEDevice.h>
#endif

#include "app/ProductIdentity.h"
#include "config/Defaults.h"

namespace connectivity {
namespace {

#ifdef JENIX_PROV_V2
constexpr char kProvisioningTransport[] = "ble";
constexpr char kProvisioningServiceUuid[] =
    "0000ffff-0000-1000-8000-00805f9b34fb";
constexpr int kSec2SaltBytes = 16;

const char* ProvFailureReasonString(wifi_prov_sta_fail_reason_t reason) {
  switch (reason) {
    case WIFI_PROV_STA_AUTH_ERROR:
      return "wifi_auth_failed";
    case WIFI_PROV_STA_AP_NOT_FOUND:
      return "wifi_ap_not_found";
    default:
      return "wifi_connect_failed";
  }
}

void ProvisioningEventHandler(void* arg, esp_event_base_t eventBase, int32_t eventId,
                              void* eventData) {
  auto* service = static_cast<BleProvisioningService*>(arg);
  if (service == nullptr) return;
  service->HandleEvent(eventBase, eventId, eventData);
}
#else
NimBLECharacteristic* gProvisionCharacteristic = nullptr;
NimBLECharacteristic* gLegacyStatusCharacteristic = nullptr;

class ProvisionCallbacks : public NimBLECharacteristicCallbacks {
 public:
  explicit ProvisionCallbacks(BleProvisioningService& owner) : owner_(owner) {}

  void onWrite(NimBLECharacteristic* characteristic) override {
    owner_.ApplyPayload(characteristic->getValue());
  }

 private:
  BleProvisioningService& owner_;
};

ProvisionCallbacks* gCallbacks = nullptr;
#endif

}  // namespace

#ifndef JENIX_PROV_V2
bool BleProvisioningService::Begin(const identity::DeviceIdentity& identity) {
  if (!initialized_) {
    NimBLEDevice::init(identity.BleName().c_str());
    NimBLEServer* server = NimBLEDevice::createServer();
    NimBLEService* service = server->createService(app::kBleServiceUuid);
    gProvisionCharacteristic =
        service->createCharacteristic(app::kBleWriteUuid, NIMBLE_PROPERTY::READ |
                                                             NIMBLE_PROPERTY::WRITE |
                                                             NIMBLE_PROPERTY::WRITE_NR |
                                                             NIMBLE_PROPERTY::NOTIFY);
    gLegacyStatusCharacteristic =
        service->createCharacteristic(app::kBleStatusUuid, NIMBLE_PROPERTY::READ |
                                                                NIMBLE_PROPERTY::NOTIFY);
    if (gCallbacks == nullptr) gCallbacks = new ProvisionCallbacks(*this);
    gProvisionCharacteristic->setCallbacks(gCallbacks);
    service->start();
    NimBLEService* info = server->createService("180A");
    info->createCharacteristic("2A24", NIMBLE_PROPERTY::READ)->setValue(app::kModel);
    info->createCharacteristic("2A25", NIMBLE_PROPERTY::READ)
        ->setValue(identity.DeviceId().c_str());
    info->createCharacteristic("2A26", NIMBLE_PROPERTY::READ)
        ->setValue(app::kFirmwareVersion);
    info->start();
    NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
    advertising->setAppearance(0x0080);
    advertising->addServiceUUID(app::kBleServiceUuid);
    advertising->addServiceUUID("180A");
    initialized_ = true;
  }
  if (started_) return true;
  NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
  if (advertising == nullptr || !advertising->start()) return false;
  started_ = true;
  lastStatus_ = "ready";
  lastMessage_ = "provisioning_ready";
  logger_.Info("BLE provisioning advertising started");
  return true;
}
#else
void BleProvisioningService::EnsureSec2Material() {
  sec2Salt_.clear();
  sec2Verifier_.clear();

  const char* pop = store_.Provisioning().proofOfPossession;
  if (pop == nullptr || pop[0] == '\0') return;

  char* generatedSalt = nullptr;
  char* generatedVerifier = nullptr;
  int generatedVerifierLen = 0;
  const esp_err_t result = esp_srp_gen_salt_verifier(
      config::kProvisioningSec2Username,
      static_cast<int>(std::strlen(config::kProvisioningSec2Username)), pop,
      static_cast<int>(std::strlen(pop)), &generatedSalt, kSec2SaltBytes,
      &generatedVerifier, &generatedVerifierLen);
  if (result != ESP_OK || generatedSalt == nullptr || generatedVerifier == nullptr ||
      generatedVerifierLen <= 0) {
    if (generatedSalt != nullptr) std::free(generatedSalt);
    if (generatedVerifier != nullptr) std::free(generatedVerifier);
    logger_.Error(String("Security2 SRP material generation failed err=") + result);
    return;
  }

  sec2Salt_.assign(generatedSalt, generatedSalt + kSec2SaltBytes);
  sec2Verifier_.assign(generatedVerifier, generatedVerifier + generatedVerifierLen);
  std::free(generatedSalt);
  std::free(generatedVerifier);
}

bool BleProvisioningService::Begin(const identity::DeviceIdentity& identity) {
  serviceName_ = identity.BleName();

  if (!eventHandlersRegistered_) {
    esp_event_handler_register(WIFI_PROV_EVENT, ESP_EVENT_ANY_ID,
                               &ProvisioningEventHandler, this);
    esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &ProvisioningEventHandler,
                               this);
    esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP,
                               &ProvisioningEventHandler, this);
    esp_event_handler_register(PROTOCOMM_TRANSPORT_BLE_EVENT, ESP_EVENT_ANY_ID,
                               &ProvisioningEventHandler, this);
    esp_event_handler_register(PROTOCOMM_SECURITY_SESSION_EVENT, ESP_EVENT_ANY_ID,
                               &ProvisioningEventHandler, this);
    eventHandlersRegistered_ = true;
  }

  if (started_) return true;

  EnsureSec2Material();
  if (sec2Salt_.empty() || sec2Verifier_.empty()) {
    lastStatus_ = "error";
    lastMessage_ = "security2_material_missing";
    return false;
  }

  WiFi.mode(WIFI_STA);
  esp_wifi_set_storage(WIFI_STORAGE_FLASH);

  if (!initialized_) {
    wifi_prov_mgr_config_t managerConfig{};
    managerConfig.scheme = wifi_prov_scheme_ble;
    managerConfig.scheme_event_handler.event_cb = nullptr;
    managerConfig.scheme_event_handler.user_data = nullptr;
    managerConfig.app_event_handler.event_cb = nullptr;
    managerConfig.app_event_handler.user_data = nullptr;

    const esp_err_t initResult = wifi_prov_mgr_init(managerConfig);
    if (initResult != ESP_OK) {
      lastStatus_ = "error";
      lastMessage_ = "wifi_prov_mgr_init_failed";
      logger_.Error(String("wifi_prov_mgr_init failed err=") + initResult);
      return false;
    }
    initialized_ = true;
  }

  wifi_prov_security2_params_t sec2Params{};
  sec2Params.salt = sec2Salt_.data();
  sec2Params.salt_len = static_cast<uint16_t>(sec2Salt_.size());
  sec2Params.verifier = sec2Verifier_.data();
  sec2Params.verifier_len = static_cast<uint16_t>(sec2Verifier_.size());

  PrintProvisioningPayload(identity);

  const esp_err_t startResult = wifi_prov_mgr_start_provisioning(
      WIFI_PROV_SECURITY_2, &sec2Params, serviceName_.c_str(), nullptr);
  if (startResult != ESP_OK) {
    lastStatus_ = "error";
    lastMessage_ = "wifi_prov_start_failed";
    logger_.Error(String("wifi_prov_mgr_start_provisioning failed err=") +
                  startResult);
    return false;
  }

  started_ = true;
  lastStatus_ = "starting";
  lastMessage_ = "security2_start_requested";
  return true;
}

void BleProvisioningService::HandleEvent(esp_event_base_t eventBase, int32_t eventId,
                                         void* eventData) {
  if (eventBase == WIFI_PROV_EVENT) {
    HandleProvEvent(eventId, eventData);
    return;
  }
  if (eventBase == WIFI_EVENT) {
    HandleWifiEvent(eventId, eventData);
    return;
  }
  if (eventBase == IP_EVENT) {
    HandleIpEvent(eventId, eventData);
    return;
  }
  if (eventBase == PROTOCOMM_TRANSPORT_BLE_EVENT) {
    HandleBleTransportEvent(eventId, eventData);
    return;
  }
  if (eventBase == PROTOCOMM_SECURITY_SESSION_EVENT) {
    HandleSecurityEvent(eventId, eventData);
  }
}

void BleProvisioningService::HandleProvEvent(int32_t eventId, void* eventData) {
  switch (eventId) {
    case WIFI_PROV_INIT:
      initialized_ = true;
      lastStatus_ = "initialized";
      lastMessage_ = "manager_initialized";
      break;
    case WIFI_PROV_START:
      started_ = true;
      lastStatus_ = "ready";
      lastMessage_ = "provisioning_started";
      logger_.Info(String("Espressif BLE provisioning started name=") + serviceName_);
      break;
    case WIFI_PROV_CRED_RECV: {
      auto* wifiStaConfig = static_cast<wifi_sta_config_t*>(eventData);
      if (wifiStaConfig == nullptr) break;
      const String ssid(reinterpret_cast<const char*>(wifiStaConfig->ssid));
      const String password(reinterpret_cast<const char*>(wifiStaConfig->password));
      store_.SaveNetwork(ssid, password);
      lastProvisionedSsid_ = ssid;
      lastFailureReason_ = "";
      lastStatus_ = "wifi_credentials_received";
      lastMessage_ = "credentials_received";
      logger_.Info(String("Received provisioning Wi-Fi credentials for SSID ") + ssid);
      break;
    }
    case WIFI_PROV_CRED_FAIL: {
      const auto reason = eventData == nullptr
                              ? WIFI_PROV_STA_AUTH_ERROR
                              : *static_cast<wifi_prov_sta_fail_reason_t*>(eventData);
      store_.SaveNetwork("", "");
      lastFailureReason_ = ProvFailureReasonString(reason);
      lastStatus_ = "error";
      lastMessage_ = lastFailureReason_;
      logger_.Warn(String("Provisioning Wi-Fi connect failed reason=") +
                   lastFailureReason_);
      wifi_prov_mgr_reset_sm_state_on_failure();
      break;
    }
    case WIFI_PROV_CRED_SUCCESS:
      lastStatus_ = "wifi_connected";
      lastMessage_ = "provisioning_success";
      lastFailureReason_ = "";
      logger_.Info("Provisioning Wi-Fi connect succeeded");
      break;
    case WIFI_PROV_END:
      started_ = false;
      lastStatus_ = "stopped";
      lastMessage_ = "provisioning_stopped";
      logger_.Info("Espressif BLE provisioning stopped");
      wifi_prov_mgr_deinit();
      break;
    case WIFI_PROV_DEINIT:
      initialized_ = false;
      sec2Salt_.clear();
      sec2Verifier_.clear();
      lastMessage_ = "manager_deinitialized";
      break;
    default:
      break;
  }
}

void BleProvisioningService::HandleWifiEvent(int32_t eventId, void* eventData) {
  (void)eventData;
  if (eventId == WIFI_EVENT_STA_DISCONNECTED && started_) {
    lastStatus_ = "wifi_disconnected";
    if (lastFailureReason_.isEmpty()) lastMessage_ = "station_disconnected";
  }
}

void BleProvisioningService::HandleIpEvent(int32_t eventId, void* eventData) {
  if (eventId != IP_EVENT_STA_GOT_IP || eventData == nullptr) return;

  auto* gotIpEvent = static_cast<ip_event_got_ip_t*>(eventData);
  char ipBuffer[16];
  std::snprintf(ipBuffer, sizeof(ipBuffer), IPSTR,
                IP2STR(&gotIpEvent->ip_info.ip));
  lastIp_ = ipBuffer;
  lastStatus_ = "wifi_connected";
  lastMessage_ = "ip_acquired";
  logger_.Info(String("Provisioned Wi-Fi IP=") + lastIp_);
}

void BleProvisioningService::HandleBleTransportEvent(int32_t eventId,
                                                     void* eventData) {
  (void)eventData;
  if (eventId == PROTOCOMM_TRANSPORT_BLE_CONNECTED) {
    lastStatus_ = "client_connected";
    lastMessage_ = "ble_client_connected";
    return;
  }
  if (eventId == PROTOCOMM_TRANSPORT_BLE_DISCONNECTED) {
    lastStatus_ = started_ ? "ready" : "idle";
    lastMessage_ = "ble_client_disconnected";
  }
}

void BleProvisioningService::HandleSecurityEvent(int32_t eventId, void* eventData) {
  (void)eventData;
  if (eventId == PROTOCOMM_SECURITY_SESSION_SETUP_OK) {
    lastStatus_ = "session_established";
    lastMessage_ = "security2_session_ok";
    logger_.Info("Security2 session established");
    return;
  }
  if (eventId == PROTOCOMM_SECURITY_SESSION_CREDENTIALS_MISMATCH) {
    lastStatus_ = "auth_failed";
    lastMessage_ = "security2_credentials_mismatch";
    logger_.Warn("Security2 credentials mismatch");
    return;
  }
  if (eventId == PROTOCOMM_SECURITY_SESSION_INVALID_SECURITY_PARAMS) {
    lastStatus_ = "error";
    lastMessage_ = "security2_invalid_params";
    logger_.Error("Security2 invalid session parameters");
  }
}

void BleProvisioningService::PrintProvisioningPayload(
    const identity::DeviceIdentity& identity) const {
  char payload[192];
  std::snprintf(payload, sizeof(payload),
                "{\"ver\":\"v1\",\"name\":\"%s\",\"username\":\"%s\","
                "\"pop\":\"%s\",\"transport\":\"%s\"}",
                identity.BleName().c_str(), config::kProvisioningSec2Username,
                store_.Provisioning().proofOfPossession, kProvisioningTransport);
  Serial.printf(
      "[PROVISIONING] Scan-and-add payload %s?data=%s\r\n",
      "https://espressif.github.io/esp-jumpstart/qrcode.html", payload);
}
#endif

void BleProvisioningService::Stop() {
#ifndef JENIX_PROV_V2
  if (!started_) return;
  NimBLEDevice::stopAdvertising();
  started_ = false;
  lastStatus_ = "standby";
  lastMessage_ = "disabled";
  logger_.Info("BLE provisioning advertising stopped");
#else
  if (started_) {
    wifi_prov_mgr_stop_provisioning();
    lastStatus_ = "stopping";
    lastMessage_ = "stop_requested";
    return;
  }
  if (initialized_) {
    wifi_prov_mgr_deinit();
    initialized_ = false;
  }
  lastStatus_ = "standby";
  lastMessage_ = "disabled";
#endif
}

void BleProvisioningService::FillJson(JsonObject object) const {
  object["started"] = started_;
  object["initialized"] = initialized_;
#ifdef JENIX_PROV_V2
  object["nameMode"] = "espressif_wifi_provisioning_ble";
  object["serviceName"] = serviceName_;
  object["serviceUuid"] = kProvisioningServiceUuid;
  object["transport"] = kProvisioningTransport;
  object["security"] = "scheme2";
  object["username"] = config::kProvisioningSec2Username;
  object["proofOfPossessionConfigured"] =
      store_.Provisioning().proofOfPossession[0] != '\0';
  if (!lastProvisionedSsid_.isEmpty()) object["lastProvisionedSsid"] = lastProvisionedSsid_;
  if (!lastIp_.isEmpty()) object["lastIp"] = lastIp_;
  if (!lastFailureReason_.isEmpty()) object["lastFailureReason"] = lastFailureReason_;
#else
  object["nameMode"] = "one_platform_provisioning_name";
  object["serviceUuid"] = app::kBleServiceUuid;
#endif
  object["lastStatus"] = lastStatus_;
  object["lastMessage"] = lastMessage_;
}

void BleProvisioningService::ApplyPayload(const std::string& payload) {
#ifdef JENIX_PROV_V2
  (void)payload;
  lastStatus_ = "disabled";
  lastMessage_ = "legacy_ble_payload_unsupported";
#else
  DynamicJsonDocument request(512);
  DynamicJsonDocument response(1024);

  if (deserializeJson(request, payload)) {
    response["ok"] = false;
    response["error"] = "invalid_json";
    lastStatus_ = "invalid";
    lastMessage_ = "json_parse_failed";
  } else if (api_ == nullptr) {
    response["ok"] = false;
    response["error"] = "provisioning_api_unavailable";
    lastStatus_ = "error";
    lastMessage_ = "api_unavailable";
  } else {
    api_->HandleProvisioningRequest(request, response);
    const bool ok = response["ok"] | false;
    lastStatus_ = ok ? "ok" : "error";
    lastMessage_ = response["cmd"].is<const char*>()
                       ? response["cmd"].as<const char*>()
                       : (response["error"] | "completed");
  }

  String encoded;
  serializeJson(response, encoded);

  if (gProvisionCharacteristic != nullptr) {
    gProvisionCharacteristic->setValue(encoded.c_str());
    gProvisionCharacteristic->notify();
  }
  if (gLegacyStatusCharacteristic != nullptr) {
    gLegacyStatusCharacteristic->setValue(encoded.c_str());
    gLegacyStatusCharacteristic->notify();
  }
#endif
}

}  // namespace connectivity
