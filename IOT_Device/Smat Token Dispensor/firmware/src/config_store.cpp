#include "config_store.h"
#include "version.h"
#include <Preferences.h>
#include <WiFi.h>
#include <esp_random.h>
#ifdef JENIX_PROV_V2
#include <wifi_provisioning/manager.h>
#endif

static Preferences s_netPrefs;
static Preferences s_devPrefs;
static NetConfig   s_net;
static DevConfig   s_dev;

static void loadStringWithLegacyKey(
    Preferences& prefs,
    const char* key,
    const char* legacyKey,
    char* out,
    size_t outSize
) {
    if (prefs.getString(key, out, outSize) == 0 && legacyKey && legacyKey[0] != '\0') {
        prefs.getString(legacyKey, out, outSize);
    }
}

static void loadNet() {
    s_netPrefs.begin("jnx_net", false); // false = read-write, creates namespace on first boot
    s_netPrefs.getString("wifiSsid",         s_net.wifiSsid,         sizeof(s_net.wifiSsid));
    s_netPrefs.getString("wifiPass",         s_net.wifiPass,         sizeof(s_net.wifiPass));
    s_netPrefs.getString("mqttHost",         s_net.mqttHost,         sizeof(s_net.mqttHost));
    s_net.mqttPort = s_netPrefs.getUShort("mqttPort", 1883);
    s_netPrefs.getString("mqttUser",         s_net.mqttUser,         sizeof(s_net.mqttUser));
    s_netPrefs.getString("mqttPass",         s_net.mqttPass,         sizeof(s_net.mqttPass));
    s_netPrefs.getString("mqttClientId",     s_net.mqttClientId,     sizeof(s_net.mqttClientId));
    loadStringWithLegacyKey(s_netPrefs, "homeId", "tenantId", s_net.homeId, sizeof(s_net.homeId));
    loadStringWithLegacyKey(s_netPrefs, "siteName", "siteId", s_net.siteName, sizeof(s_net.siteName));
    s_netPrefs.getString("deviceId",         s_net.deviceId,         sizeof(s_net.deviceId));
    s_netPrefs.getString("otaUrl",           s_net.otaUrl,           sizeof(s_net.otaUrl));
    s_netPrefs.getString("httpFallback",     s_net.httpFallbackUrl,  sizeof(s_net.httpFallbackUrl));
    s_netPrefs.getString("webUser",          s_net.webUser,          sizeof(s_net.webUser));
    s_netPrefs.getString("webPass",          s_net.webPass,          sizeof(s_net.webPass));
    s_netPrefs.getString("otaPassword",      s_net.otaPassword,      sizeof(s_net.otaPassword));
    s_netPrefs.getString("localApiToken",    s_net.localApiToken,    sizeof(s_net.localApiToken));
    s_netPrefs.end();

    // Apply defaults
    if (strlen(s_net.webUser)    == 0) strlcpy(s_net.webUser,    "admin",           sizeof(s_net.webUser));
    if (strlen(s_net.webPass)    == 0) strlcpy(s_net.webPass,    "jenix1234",       sizeof(s_net.webPass));
    if (strlen(s_net.otaPassword)== 0) strlcpy(s_net.otaPassword,"jenix_ota_secret",sizeof(s_net.otaPassword));
    if (s_net.mqttPort           == 0) s_net.mqttPort = 1883;
}

static void loadDev() {
    s_devPrefs.begin("jnx_dev", false); // false = read-write, creates namespace on first boot
    s_devPrefs.getString("tokenPrefix", s_dev.tokenPrefix, sizeof(s_dev.tokenPrefix));
    s_dev.dailyResetHour    = s_devPrefs.getUInt("dailyResetHour",  255);
    s_dev.tokensPerRoll     = s_devPrefs.getUInt("tokensPerRoll",   500);
    s_dev.lowPaperThreshold = s_devPrefs.getUInt("lowPaperThr",     50);
    s_dev.queueOneBusy      = s_devPrefs.getBool("queueOneBusy",    true);
    s_dev.longPressRollReset= s_devPrefs.getBool("lpRollReset",     false);
    s_dev.buzzerEnabled     = s_devPrefs.getBool("buzzerEnabled",   false);
    s_dev.ledBrightness     = s_devPrefs.getUInt("ledBrightness",   255);
    s_dev.ledCount          = s_devPrefs.getUInt("ledCount",        3);

    size_t keyLen = s_devPrefs.getBytesLength("espNowKey");
    if (keyLen == 8) {
        s_devPrefs.getBytes("espNowKey", s_dev.espNowKey, 8);
    } else {
        // Default key derived from chip ID
        uint64_t chipId = ESP.getEfuseMac();
        memcpy(s_dev.espNowKey, &chipId, 8);
    }
    s_devPrefs.end();
}

namespace ConfigStore {

void begin() {
    loadNet();
    loadDev();
    ensureDeviceId();
}

NetConfig& net() { return s_net; }
DevConfig& dev() { return s_dev; }

void saveNet() {
    s_netPrefs.begin("jnx_net", false);
    s_netPrefs.putString("wifiSsid",     s_net.wifiSsid);
    s_netPrefs.putString("wifiPass",     s_net.wifiPass);
    s_netPrefs.putString("mqttHost",     s_net.mqttHost);
    s_netPrefs.putUShort("mqttPort",     s_net.mqttPort);
    s_netPrefs.putString("mqttUser",     s_net.mqttUser);
    s_netPrefs.putString("mqttPass",     s_net.mqttPass);
    s_netPrefs.putString("mqttClientId", s_net.mqttClientId);
    s_netPrefs.putString("homeId",       s_net.homeId);
    s_netPrefs.remove("tenantId");
    s_netPrefs.putString("siteName",     s_net.siteName);
    s_netPrefs.remove("siteId");
    s_netPrefs.putString("deviceId",     s_net.deviceId);
    s_netPrefs.putString("otaUrl",       s_net.otaUrl);
    s_netPrefs.putString("httpFallback", s_net.httpFallbackUrl);
    s_netPrefs.putString("webUser",      s_net.webUser);
    s_netPrefs.putString("webPass",      s_net.webPass);
    s_netPrefs.putString("otaPassword",  s_net.otaPassword);
    s_netPrefs.putString("localApiToken",s_net.localApiToken);
    s_netPrefs.end();
}

void saveDev() {
    s_devPrefs.begin("jnx_dev", false);
    s_devPrefs.putString("tokenPrefix",   s_dev.tokenPrefix);
    s_devPrefs.putUInt("dailyResetHour",  s_dev.dailyResetHour);
    s_devPrefs.putUInt("tokensPerRoll",   s_dev.tokensPerRoll);
    s_devPrefs.putUInt("lowPaperThr",     s_dev.lowPaperThreshold);
    s_devPrefs.putBool("queueOneBusy",    s_dev.queueOneBusy);
    s_devPrefs.putBool("lpRollReset",     s_dev.longPressRollReset);
    s_devPrefs.putBool("buzzerEnabled",   s_dev.buzzerEnabled);
    s_devPrefs.putUInt("ledBrightness",   s_dev.ledBrightness);
    s_devPrefs.putUInt("ledCount",        s_dev.ledCount);
    s_devPrefs.putBytes("espNowKey",      s_dev.espNowKey, 8);
    s_devPrefs.end();
}

void ensureDeviceId() {
    if (strlen(s_net.deviceId) == 0) {
        // Must match the app's own derivation exactly (bleDiscoveryService.ts
        // deriveDeviceIdFromPid: FIRMWARE_PID with its trailing "-NN" instance
        // number stripped, "-", then the same last-3-MAC-bytes hex suffix the
        // BLE advertised name already carries via buildServiceName() in
        // provisioning2.cpp). Any mismatch means every topic this firmware
        // publishes to (status/lwt/events/cmd) targets a deviceId the backend
        // never registered, so nothing -- including the offline LWT -- ever
        // reaches the real device record.
        uint8_t mac[6];
        WiFi.macAddress(mac);
        snprintf(s_net.deviceId, sizeof(s_net.deviceId),
                 "JNX-TD-C3-%02X%02X%02X",
                 mac[3], mac[4], mac[5]);
        saveNet();
    }
    if (strlen(s_net.mqttClientId) == 0) {
        strlcpy(s_net.mqttClientId, s_net.deviceId, sizeof(s_net.mqttClientId));
        saveNet();
    }
}

bool ensureLocalApiToken(bool* generated) {
    if (generated != nullptr) *generated = false;
    if (strlen(s_net.localApiToken) > 0) return true;

    uint8_t raw[16];
    esp_fill_random(raw, sizeof(raw));
    static const char* hex = "0123456789ABCDEF";
    for (size_t i = 0; i < sizeof(raw); i++) {
        s_net.localApiToken[i * 2]     = hex[raw[i] >> 4];
        s_net.localApiToken[i * 2 + 1] = hex[raw[i] & 0x0F];
    }
    s_net.localApiToken[sizeof(raw) * 2] = '\0';
    if (generated != nullptr) *generated = true;
    saveNet();
    return true;
}

void resetNet() {
    s_netPrefs.begin("jnx_net", false);
    s_netPrefs.clear();
    s_netPrefs.end();
    memset(&s_net, 0, sizeof(s_net));
    loadNet();
    ensureDeviceId();
}

void resetDev() {
    s_devPrefs.begin("jnx_dev", false);
    s_devPrefs.clear();
    s_devPrefs.end();
    memset(&s_dev, 0, sizeof(s_dev));
    loadDev();
}

void factoryReset() {
    resetNet();
    resetDev();
    // Token manager and paper estimator reset themselves on first boot
    Preferences p;
    p.begin("jnx_tok", false);  p.clear(); p.end();
    p.begin("jnx_pap", false);  p.clear(); p.end();
#ifdef JENIX_PROV_V2
    p.begin("jnx_pop", false);  p.clear(); p.end();
    wifi_prov_mgr_reset_provisioning(); // clears esp_wifi's own persisted STA config
#endif
}

} // namespace ConfigStore
