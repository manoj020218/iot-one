#include "connectivity/BleProvisioningService.h"

#include <NimBLEDevice.h>

#include "app/ProductIdentity.h"

namespace connectivity {
namespace {

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

}  // namespace

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
  object["nameMode"] = "one_platform_provisioning_name";
  object["serviceUuid"] = app::kBleServiceUuid;
  object["lastStatus"] = lastStatus_;
  object["lastMessage"] = lastMessage_;
}

void BleProvisioningService::ApplyPayload(const std::string& payload) {
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
}

}  // namespace connectivity
