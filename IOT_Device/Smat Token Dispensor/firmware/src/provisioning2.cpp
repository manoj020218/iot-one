// Only built for the jenix-td-c3-prov2 env (framework=arduino,espidf). All
// other envs (including the default jenix-td-c3) still compile this
// translation unit — PlatformIO builds every src/*.cpp for every
// environment regardless of ifdefs elsewhere — so this must no-op cleanly
// rather than pull in ESP-IDF-only headers those envs don't have.
#ifdef JENIX_PROV_V2

#include "provisioning2.h"
#include "config_store.h"
#include "event_log.h"

#include <WiFi.h>
#include <Preferences.h>
#include <esp_random.h>
#include <esp_event.h>
#include <esp_srp.h>
#include <wifi_provisioning/manager.h>
#include <wifi_provisioning/scheme_ble.h>

// ---------------------------------------------------------------------------
// SRP6a (Security Scheme 2) parameters
// ---------------------------------------------------------------------------
// Username is not secret — it's the fixed identity Espressif's own reference
// apps (esp-idf-provisioning-android/ios, PROVISIONING.md's app-side basis)
// use for Security Scheme 2. The actual secret is the per-device PoP below.
// If the Jenix app's provisioning SDK integration overrides this, it must
// match exactly or the SRP6a handshake will fail.
static const char* SEC2_USERNAME  = "wifiprov";
static const int   SEC2_SALT_LEN  = 16;

// PROVISIONING.md §1 — fixed 128-bit BLE service UUID
// 021a9004-0382-4aea-bff4-6b3f1c5adfb4, byte-reversed (LSB..MSB) as required
// by wifi_prov_scheme_ble_set_service_uuid().
static uint8_t s_serviceUuid[16] = {
    0xb4, 0xdf, 0x5a, 0x1c, 0x3f, 0x6b, 0xf4, 0xbf,
    0xea, 0x4a, 0x82, 0x03, 0x04, 0x90, 0x1a, 0x02,
};

static bool     s_mgrInited   = false;
static bool     s_active      = false;
static bool     s_provisioned = false;
static uint32_t s_startMs     = 0;
static char     s_pop[33]     = {0};
static char     s_bleName[16] = {0};

// Must stay valid for as long as the provisioning service is running —
// protocomm holds onto this pointer, not a copy.
static protocomm_security2_params_t s_sec2Params;

// ---------------------------------------------------------------------------
// Proof-of-Possession — load from NVS, or generate + persist on first boot
// ---------------------------------------------------------------------------
static void loadOrGeneratePop() {
    Preferences p;
    p.begin("jnx_pop", false);
    size_t n = p.getString("pop", s_pop, sizeof(s_pop));
    bool generated = false;

    if (n == 0) {
        uint8_t raw[12];
        esp_fill_random(raw, sizeof(raw));
        static const char* hex = "0123456789ABCDEF";
        for (size_t i = 0; i < sizeof(raw); i++) {
            s_pop[i * 2]     = hex[raw[i] >> 4];
            s_pop[i * 2 + 1] = hex[raw[i] & 0x0F];
        }
        s_pop[sizeof(raw) * 2] = '\0';
        p.putString("pop", s_pop);
        generated = true;
        EventLog::info("PROV", "Generated new device Proof-of-Possession");
    }
    p.end();

    Serial.printf("[PROVISIONING] Security2 username %s PoP source=%s value=%s\r\n",
                  SEC2_USERNAME, generated ? "generated" : "stored", s_pop);
    EventLog::info("PROV", "Provisioning2 PoP ready");
}

static void buildServiceName(char* out, size_t len) {
    uint8_t mac[6];
    WiFi.macAddress(mac);
    snprintf(out, len, "JNXTD%02X%02X%02X", mac[3], mac[4], mac[5]);
}

// ---------------------------------------------------------------------------
// WIFI_PROV_EVENT handler
// ---------------------------------------------------------------------------
static void provEventHandler(void* /*arg*/, esp_event_base_t eventBase,
                              int32_t eventId, void* eventData) {
    if (eventBase != WIFI_PROV_EVENT) return;

    switch (eventId) {
        case WIFI_PROV_START:
            EventLog::info("PROV", "Provisioning started (BLE, Security2)");
            break;

        case WIFI_PROV_CRED_RECV: {
            wifi_sta_config_t* cfg = (wifi_sta_config_t*) eventData;
            char ssid[33] = {0};
            char pass[65] = {0};
            memcpy(ssid, cfg->ssid, sizeof(cfg->ssid));
            memcpy(pass, cfg->password, sizeof(cfg->password));
            ssid[32] = '\0';
            pass[64] = '\0';

            strlcpy(ConfigStore::net().wifiSsid, ssid, sizeof(ConfigStore::net().wifiSsid));
            strlcpy(ConfigStore::net().wifiPass, pass, sizeof(ConfigStore::net().wifiPass));
            ConfigStore::saveNet();
            EventLog::info("PROV", "WiFi credentials received via protocomm/BLE");
            break;
        }

        case WIFI_PROV_CRED_FAIL:
            EventLog::error("PROV", "WiFi credentials rejected (bad auth or AP not found)");
            break;

        case WIFI_PROV_CRED_SUCCESS:
            s_provisioned = true;
            EventLog::info("PROV", "Provisioning succeeded — WiFi connected");
            break;

        case WIFI_PROV_END:
            s_active = false;
            if (s_mgrInited) {
                wifi_prov_mgr_deinit();
                s_mgrInited = false;
            }
            EventLog::info("PROV", "Provisioning service stopped");
            break;

        default:
            break;
    }
}

namespace Provisioning2 {

void begin() {
    loadOrGeneratePop();

    wifi_prov_mgr_config_t config = {};
    config.scheme               = wifi_prov_scheme_ble;
    config.scheme_event_handler = WIFI_PROV_SCHEME_BLE_EVENT_HANDLER_FREE_BTDM;
    config.app_event_handler    = WIFI_PROV_EVENT_HANDLER_NONE;

    if (wifi_prov_mgr_init(config) != ESP_OK) {
        EventLog::error("PROV", "wifi_prov_mgr_init failed");
        return;
    }
    s_mgrInited = true;

    esp_event_handler_register(WIFI_PROV_EVENT, ESP_EVENT_ANY_ID, &provEventHandler, nullptr);

    // Phase 0 (PROVISIONING.md §3) — already have WiFi creds via esp_wifi's
    // own NVS store? Skip advertising entirely.
    bool provisioned = false;
    wifi_prov_mgr_is_provisioned(&provisioned);
    if (provisioned) {
        s_provisioned = true;
        wifi_prov_mgr_deinit();
        s_mgrInited = false;
        return;
    }

    wifi_prov_scheme_ble_set_service_uuid(s_serviceUuid);

    buildServiceName(s_bleName, sizeof(s_bleName));

    char* saltBuf     = nullptr;
    char* verifierBuf = nullptr;
    int   verifierLen = 0;
    esp_err_t genErr = esp_srp_gen_salt_verifier(
        SEC2_USERNAME, strlen(SEC2_USERNAME),
        s_pop, strlen(s_pop),
        &saltBuf, SEC2_SALT_LEN,
        &verifierBuf, &verifierLen);

    if (genErr != ESP_OK || !saltBuf || !verifierBuf) {
        EventLog::error("PROV", "Failed to derive SRP6a salt/verifier from PoP");
        wifi_prov_mgr_deinit();
        s_mgrInited = false;
        return;
    }

    s_sec2Params.salt         = saltBuf;
    s_sec2Params.salt_len     = SEC2_SALT_LEN;
    s_sec2Params.verifier     = verifierBuf;
    s_sec2Params.verifier_len = (uint16_t) verifierLen;

    esp_err_t err = wifi_prov_mgr_start_provisioning(
        WIFI_PROV_SECURITY_2, &s_sec2Params, s_bleName, nullptr);

    if (err != ESP_OK) {
        EventLog::error("PROV", "Failed to start provisioning service");
        wifi_prov_mgr_deinit();
        s_mgrInited = false;
        return;
    }

    s_active  = true;
    s_startMs = millis();

    char msg[48];
    snprintf(msg, sizeof(msg), "BLE provisioning started as %s", s_bleName);
    EventLog::info("PROV", msg);
}

void stop() {
    if (!s_active) return;
    wifi_prov_mgr_stop_provisioning(); // async — WIFI_PROV_END finishes cleanup
}

bool isActive() {
    if (!s_active) return false;
    if (millis() - s_startMs > PROV2_BLE_WINDOW_MS) {
        stop();
        return false;
    }
    return true;
}

bool isProvisioned() { return s_provisioned; }

const char* bleName() { return s_bleName; }

} // namespace Provisioning2

#endif // JENIX_PROV_V2
