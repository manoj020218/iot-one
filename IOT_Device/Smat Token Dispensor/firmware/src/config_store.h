#pragma once
#include <Arduino.h>

// ---------------------------------------------------------------------------
// config_store — NVS-backed persistent configuration
// Uses Preferences library (ESP32 NVS) with two namespaces:
//   "jnx_net"  → network / cloud settings
//   "jnx_dev"  → device / operational settings
// ---------------------------------------------------------------------------

struct NetConfig {
    char wifiSsid[64];
    char wifiPass[64];
    char mqttHost[128];
    uint16_t mqttPort;
    char mqttUser[64];
    char mqttPass[64];
    char mqttClientId[64];
    char homeId[64];
    char siteName[64];
    char deviceId[64];
    char otaUrl[256];           // Base URL for OTA firmware
    char httpFallbackUrl[256];  // HTTP POST endpoint for telemetry fallback
    char webUser[32];
    char webPass[64];
    char otaPassword[64];       // ArduinoOTA password
    char localApiToken[33];     // X-Jenix-Local-Token header value (32 hex chars)
};

struct DevConfig {
    char tokenPrefix[16];       // e.g. "A", "OPD", ""
    uint32_t dailyResetHour;    // 0-23, 255 = disabled
    uint32_t tokensPerRoll;     // paper estimation
    uint32_t lowPaperThreshold; // tokens remaining below this = alert
    bool queueOneBusy;          // queue one extra request when printer busy
    bool longPressRollReset;    // enable 10s long-press to reset roll
    uint8_t espNowKey[8];       // shared security key for ESP-NOW commands
    bool buzzerEnabled;
    uint32_t ledBrightness;     // 0-255 (future PWM)
    uint32_t ledCount;          // WS2812 pixels behind the touch button (1-8)
};

namespace ConfigStore {
    void begin();

    // Network config
    NetConfig& net();
    void saveNet();
    void resetNet();

    // Device/operational config
    DevConfig& dev();
    void saveDev();
    void resetDev();

    // Convenience: generate unique device ID from MAC if not set
    void ensureDeviceId();

    // Generate + persist a local API token (X-Jenix-Local-Token) on first
    // boot if none exists yet. *generated is set true only when freshly
    // generated (vs. already present from a prior boot).
    bool ensureLocalApiToken(bool* generated = nullptr);

    // Full factory reset
    void factoryReset();
}
