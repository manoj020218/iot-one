#include "ota_service.h"
#include "config_store.h"
#include "event_log.h"
#include "mqtt_client.h"
#include "version.h"
#ifndef JENIX_PROV_V2
#include <ArduinoOTA.h>
#endif
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <WiFi.h>

static volatile bool s_updating = false;

namespace OtaService {

void begin() {
#ifndef JENIX_PROV_V2
    ArduinoOTA.setHostname(ConfigStore::net().deviceId);
    ArduinoOTA.setPassword(ConfigStore::net().otaPassword);
    ArduinoOTA.setPort(3232);

    ArduinoOTA.onStart([]() {
        s_updating = true;
        MqttClient::disconnect();
        EventLog::info("OTA", "ArduinoOTA start");
    });

    ArduinoOTA.onEnd([]() {
        EventLog::info("OTA", "ArduinoOTA complete — rebooting");
    });

    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
        static uint8_t lastPct = 0;
        uint8_t pct = (uint8_t)(progress * 100 / total);
        if (pct != lastPct && pct % 10 == 0) {
            char msg[32];
            snprintf(msg, sizeof(msg), "OTA progress: %d%%", pct);
            Serial.println(msg);
            lastPct = pct;
        }
    });

    ArduinoOTA.onError([](ota_error_t error) {
        char msg[48];
        snprintf(msg, sizeof(msg), "ArduinoOTA error: %u", error);
        EventLog::error("OTA", msg);
        s_updating = false;
    });

    ArduinoOTA.begin();
    EventLog::info("OTA", "ArduinoOTA ready");
#else
    EventLog::info("OTA", "ArduinoOTA disabled in prov2 pilot");
#endif
}

void loop() {
#ifndef JENIX_PROV_V2
    ArduinoOTA.handle();
#endif
}

bool startHttpOta(const char* url) {
    if (!url || strlen(url) == 0) return false;
    s_updating = true;

    EventLog::info("OTA", "HTTP OTA starting");
    MqttClient::disconnect();

    WiFiClient client;
    httpUpdate.setLedPin(PIN_LED, PIN_LED_ACTIVE_LOW ? LOW : HIGH);
    httpUpdate.rebootOnUpdate(true);

    t_httpUpdate_return ret = httpUpdate.update(client, url);

    switch (ret) {
        case HTTP_UPDATE_OK:
            EventLog::info("OTA", "HTTP OTA success — rebooting");
            return true;

        case HTTP_UPDATE_FAILED: {
            char msg[128];
            snprintf(msg, sizeof(msg), "HTTP OTA failed: %s",
                     httpUpdate.getLastErrorString().c_str());
            EventLog::error("OTA", msg);
            s_updating = false;
            return false;
        }

        case HTTP_UPDATE_NO_UPDATES:
            EventLog::info("OTA", "HTTP OTA: no update available");
            s_updating = false;
            return false;

        default:
            s_updating = false;
            return false;
    }
}

bool isUpdating() { return s_updating; }

} // namespace OtaService
