#pragma once

#include <Arduino.h>

enum class StatusLedTriggerSource : uint8_t {
    BUTTON = 0,
    REMOTE = 1,
};

namespace StatusLed {
    void begin();
    void signalTrigger(StatusLedTriggerSource source);

    // Applies a new WS2812 chain length / full-brightness ceiling
    // immediately (e.g. after the installer changes it via local web UI /
    // MQTT / app) -- neither persists to ConfigStore, callers already own
    // that (same pattern as every other SET_* command in mqtt_client.cpp).
    void setPixelCount(uint8_t count);
    void setBrightness(uint8_t brightness);
}
