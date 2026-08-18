#include "connectivity/BleProvisioningService.h"

#include <NimBLEDevice.h>

#include "app/ProductIdentity.h"

namespace connectivity {
namespace {

NimBLECharacteristic* gStatusCharacteristic = nullptr;

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

}  // namespace

bool BleProvisioningService::Begin(const identity::DeviceIdentity& identity) {
  if (!initialized_) {
    NimBLEDevice::init(identity.BleName().c_str());
    NimBLEServer* server = NimBLEDevice::createServer();
    NimBLEService* service = server->createService(app::kBleServiceUuid);
    NimBLECharacteristic* writer =
        service->createCharacteristic(app::kBleWriteUuid, NIMBLE_PROPERTY::WRITE |
                                                             NIMBLE_PROPERTY::WRITE_NR);
    gStatusCharacteristic =
        service->createCharacteristic(app::kBleStatusUuid, NIMBLE_PROPERTY::READ |
                                                                NIMBLE_PROPERTY::NOTIFY);
    if (gCallbacks == nullptr) gCallbacks = new ProvisionCallbacks(*this);
    writer->setCallbacks(gCallbacks);
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
  lastMessage_ = "wifi_only";
  logger_.Info("BLE provisioning advertising started");
  return true;
}

void BleProvisioningService::Stop() {
  if (!started_) return;
  NimBLEDevice::stopAdvertising();
  started_ = false;
  lastStatus_ = "standby";
  lastMessage_ = "disabled";
  logger_.Info("BLE provisioning advertising stopped");
}

void BleProvisioningService::FillJson(JsonObject object) const {
  object["started"] = started_;
  object["initialized"] = initialized_;
  object["nameMode"] = "shared_ap_ble_name";
  object["serviceUuid"] = app::kBleServiceUuid;
  object["lastStatus"] = lastStatus_;
  object["lastMessage"] = lastMessage_;
}

void BleProvisioningService::ApplyPayload(const std::string& payload) {
  DynamicJsonDocument doc(512);
  if (deserializeJson(doc, payload)) {
    lastStatus_ = "invalid";
    lastMessage_ = "json_parse_failed";
  } else if ((doc["clearWifi"] | false) || (doc["apRecovery"] | false)) {
    lastStatus_ = wifiManager_.ClearSavedNetwork() ? "applied" : "error";
    lastMessage_ = lastStatus_ == "applied" ? "ap_recovery" : "ap_recovery_failed";
  } else {
    const String ssid = doc["wifiSsid"].is<const char*>() ? doc["wifiSsid"].as<const char*>()
                                                          : (doc["ssid"] | "");
    const String password = doc["wifiPassword"].is<const char*>()
                                ? doc["wifiPassword"].as<const char*>()
                                : (doc["password"] | "");
    if (ssid.isEmpty()) {
      lastStatus_ = "invalid";
      lastMessage_ = "missing_wifi_ssid";
    } else if (wifiManager_.SaveAndReconnect(ssid, password)) {
      logger_.Info(String("BLE Wi-Fi provisioning applied for SSID ") + ssid);
      lastStatus_ = "applied";
      lastMessage_ = "wifi_saved";
    } else {
      lastStatus_ = "error";
      lastMessage_ = "wifi_save_failed";
    }
  }
  if (gStatusCharacteristic == nullptr) return;
  DynamicJsonDocument status(192);
  status["status"] = lastStatus_;
  status["message"] = lastMessage_;
  String encoded;
  serializeJson(status, encoded);
  gStatusCharacteristic->setValue(encoded.c_str());
  gStatusCharacteristic->notify();
}

}  // namespace connectivity
