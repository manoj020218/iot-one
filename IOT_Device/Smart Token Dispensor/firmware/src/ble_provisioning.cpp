// Not built for jenix-td-c3-prov2 (framework=arduino,espidf) — that env
// deliberately drops NimBLE-Arduino from lib_deps in favor of the
// ESP-IDF wifi_provisioning/protocomm BLE transport (see provisioning2.cpp),
// and the two must not both link against the BLE controller. PlatformIO
// builds every src/*.cpp for every environment regardless of ifdefs
// elsewhere, so this must no-op cleanly for that env rather than fail to
// find NimBLEDevice.h.
#ifndef JENIX_PROV_V2

#include "ble_provisioning.h"
#include "config_store.h"
#include "event_log.h"
#include <NimBLEDevice.h>
#include <ArduinoJson.h>
#include <WiFi.h>

// Jenix custom BLE service / characteristic UUIDs
#define SVC_UUID   "12340000-0000-1000-8000-00805F9B34FB"
#define CHAR_WIFI  "12340001-0000-1000-8000-00805F9B34FB"
#define CHAR_BIND  "12340002-0000-1000-8000-00805F9B34FB"
#define CHAR_STATUS "12340003-0000-1000-8000-00805F9B34FB"

static NimBLEServer*         s_server     = nullptr;
static NimBLECharacteristic* s_charStatus = nullptr;
static bool                  s_active     = false;
static bool                  s_provisioned= false;
static uint32_t              s_startMs    = 0;

// ---------------------------------------------------------------------------
// Characteristic callbacks
// ---------------------------------------------------------------------------
// NimBLE-Arduino 1.4.x callback signatures (no NimBLEConnInfo parameter)
class WifiCharCb : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* c) override {
        std::string val = c->getValue();
        JsonDocument doc;
        if (deserializeJson(doc, val.c_str()) != DeserializationError::Ok) {
            EventLog::error("BLE", "WiFi characteristic: invalid JSON");
            return;
        }
        const char* ssid = doc["ssid"] | "";
        const char* pass = doc["pass"] | "";
        if (strlen(ssid) == 0) {
            EventLog::error("BLE", "WiFi characteristic: missing ssid");
            return;
        }
        strlcpy(ConfigStore::net().wifiSsid, ssid, 64);
        strlcpy(ConfigStore::net().wifiPass, pass, 64);
        ConfigStore::saveNet();
        s_provisioned = true;
        EventLog::info("BLE", "WiFi credentials received via BLE");
    }
};

class BindCharCb : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* c) override {
        std::string val = c->getValue();
        JsonDocument doc;
        if (deserializeJson(doc, val.c_str()) != DeserializationError::Ok) {
            EventLog::error("BLE", "Bind characteristic: invalid JSON");
            return;
        }
        const char* homeId = doc["homeId"].is<const char*>()
            ? doc["homeId"].as<const char*>()
            : (doc["tenantId"] | "");
        const char* siteName = doc["siteName"].is<const char*>()
            ? doc["siteName"].as<const char*>()
            : (doc["siteId"] | "");
        if (strlen(homeId)) {
            strlcpy(ConfigStore::net().homeId, homeId, sizeof(ConfigStore::net().homeId));
        }
        if (strlen(siteName)) {
            strlcpy(ConfigStore::net().siteName, siteName, sizeof(ConfigStore::net().siteName));
        }
        ConfigStore::saveNet();
        EventLog::info("BLE", "Home binding received via BLE");
    }
};

class ServerCb : public NimBLEServerCallbacks {
    void onConnect(NimBLEServer* s) override {
        EventLog::info("BLE", "Client connected");
    }
    void onDisconnect(NimBLEServer* s) override {
        EventLog::info("BLE", "Client disconnected");
        if (!s_provisioned) {
            NimBLEDevice::startAdvertising();
        }
    }
};

namespace BleProvisioning {

void begin() {
    uint8_t mac[6];
    WiFi.macAddress(mac);
    char name[20];
    snprintf(name, sizeof(name), "JNX-TD-%02X%02X", mac[4], mac[5]);

    NimBLEDevice::init(name);
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);

    s_server = NimBLEDevice::createServer();
    s_server->setCallbacks(new ServerCb());

    NimBLEService* svc = s_server->createService(SVC_UUID);

    NimBLECharacteristic* cWifi = svc->createCharacteristic(
        CHAR_WIFI,
        NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
    );
    cWifi->setCallbacks(new WifiCharCb());

    NimBLECharacteristic* cBind = svc->createCharacteristic(
        CHAR_BIND,
        NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
    );
    cBind->setCallbacks(new BindCharCb());

    s_charStatus = svc->createCharacteristic(
        CHAR_STATUS,
        NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
    );
    s_charStatus->setValue("{\"status\":\"ready\"}");

    svc->start();

    NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
    adv->addServiceUUID(SVC_UUID);
    adv->setScanResponse(true);
    NimBLEDevice::startAdvertising();

    s_active  = true;
    s_startMs = millis();
    EventLog::info("BLE", "BLE provisioning started");
}

void stop() {
    if (!s_active) return;
    NimBLEDevice::stopAdvertising();
    s_active = false;
    EventLog::info("BLE", "BLE provisioning stopped");
}

bool isActive() {
    if (!s_active) return false;
    // Auto-stop after window expires
    if (millis() - s_startMs > BLE_WINDOW_MS) {
        stop();
        return false;
    }
    return true;
}

bool isProvisioned() { return s_provisioned; }

} // namespace BleProvisioning

#endif // !JENIX_PROV_V2
