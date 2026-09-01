#include "status_led.h"
#include "version.h"
#include "config_store.h"
#include "paper_estimator.h"
#include "printer_driver.h"
#include "JenixLedStatus.h"
#include <WiFi.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <freertos/task.h>

namespace {

enum class TransientPattern : uint8_t {
    NONE = 0,
    BUTTON_ACK,
    REMOTE_ACK,
    WIFI_CONNECTED,
    PRINT_SUCCESS,
    PRINT_FAILED,
};

struct RGB { uint8_t r, g, b; };
constexpr RGB OFF_C    = {0, 0, 0};
constexpr RGB WHITE_C  = {255, 255, 255};
constexpr RGB GREEN_C  = {0, 255, 0};
constexpr RGB BLUE_C   = {0, 70, 255};
constexpr RGB CYAN_C   = {0, 255, 255};
constexpr RGB ORANGE_C = {255, 70, 0};
constexpr RGB RED_C    = {255, 0, 0};

// PIN_STATUS_LED is the one WS2812 data pin on this board -- PIN_LED (the
// dev board's own built-in LED) is a plain single-color LED and stays
// untouched, driven separately in main.cpp.
JenixLedStatus s_led(PIN_STATUS_LED);

SemaphoreHandle_t s_transientMtx = nullptr;
TransientPattern  s_transient    = TransientPattern::NONE;
uint32_t          s_transientMs  = 0;

uint32_t transientDurationMs(TransientPattern pattern) {
    switch (pattern) {
        case TransientPattern::BUTTON_ACK:     return 120;
        case TransientPattern::REMOTE_ACK:     return 240;
        case TransientPattern::WIFI_CONNECTED: return 420;
        case TransientPattern::PRINT_SUCCESS:  return 640;
        case TransientPattern::PRINT_FAILED:   return 900;
        default:                               return 0;
    }
}

RGB transientColor(TransientPattern pattern) {
    switch (pattern) {
        case TransientPattern::BUTTON_ACK:     return WHITE_C;
        case TransientPattern::REMOTE_ACK:     return CYAN_C;
        case TransientPattern::WIFI_CONNECTED: return GREEN_C;
        case TransientPattern::PRINT_SUCCESS:  return GREEN_C;
        case TransientPattern::PRINT_FAILED:   return RED_C;
        default:                               return OFF_C;
    }
}

bool transientLedOn(TransientPattern pattern, uint32_t elapsedMs) {
    switch (pattern) {
        case TransientPattern::BUTTON_ACK:
            return elapsedMs < 120;

        case TransientPattern::REMOTE_ACK:
            return (elapsedMs < 80) ||
                   (elapsedMs >= 140 && elapsedMs < 220);

        case TransientPattern::WIFI_CONNECTED:
            return (elapsedMs < 140) ||
                   (elapsedMs >= 220 && elapsedMs < 360);

        case TransientPattern::PRINT_SUCCESS:
            return ((elapsedMs / 80) % 2) == 0;

        case TransientPattern::PRINT_FAILED:
            return ((elapsedMs / 75) % 2) == 0;

        default:
            return false;
    }
}

void setTransient(TransientPattern pattern) {
    if (!s_transientMtx) return;

    xSemaphoreTake(s_transientMtx, portMAX_DELAY);
    s_transient   = pattern;
    s_transientMs = millis();
    xSemaphoreGive(s_transientMtx);
}

// Returns true (and fills `color`) if a transient is active this tick.
bool consumeTransientIfActive(uint32_t nowMs, RGB& color) {
    if (!s_transientMtx) return false;

    xSemaphoreTake(s_transientMtx, portMAX_DELAY);
    TransientPattern pattern = s_transient;
    uint32_t startedMs       = s_transientMs;
    xSemaphoreGive(s_transientMtx);

    if (pattern == TransientPattern::NONE) {
        return false;
    }

    uint32_t elapsedMs = nowMs - startedMs;
    if (elapsedMs >= transientDurationMs(pattern)) {
        xSemaphoreTake(s_transientMtx, portMAX_DELAY);
        if (s_transient == pattern && s_transientMs == startedMs) {
            s_transient = TransientPattern::NONE;
        }
        xSemaphoreGive(s_transientMtx);
        return false;
    }

    color = transientLedOn(pattern, elapsedMs) ? transientColor(pattern) : OFF_C;
    return true;
}

// Base (non-transient) color for the device's current lifecycle/printer
// state -- same conditions the old monochrome on/off version checked, now
// recolored per JenixLedStatus's standard palette (BLUE=provisioning/
// disconnected, GREEN=ready, ORANGE=warning, RED=fault, WHITE=busy) instead
// of a single color blinking at different rates.
RGB basePatternColor(uint32_t nowMs) {
    PrinterState printerState = PrinterDriver::state();
    bool wifiExpected         = strlen(ConfigStore::net().wifiSsid) > 0;
    bool wifiConnected        = (WiFi.status() == WL_CONNECTED);
    bool paperOut             = (printerState == PrinterState::PAPER_OUT);
    bool paperLow             = (printerState == PrinterState::PAPER_LOW) ||
                                PaperEstimator::isPaperLow();

    if (printerState == PrinterState::PRINTING) {
        // Fast white blink -- same feel as JenixLedState::BUSY, so the user
        // gets instant, unmistakable "the printer is working" feedback.
        return ((nowMs % 160) < 80) ? WHITE_C : OFF_C;
    }

    if (paperOut) {
        uint32_t slot = nowMs % 1600;
        return ((slot < 120) || (slot >= 240 && slot < 360) || (slot >= 480 && slot < 600))
                   ? RED_C : OFF_C;
    }

    if (paperLow) {
        uint32_t slot = nowMs % 2200;
        return ((slot < 140) || (slot >= 280 && slot < 420)) ? ORANGE_C : OFF_C;
    }

    if (!wifiExpected) {
        // Never provisioned yet -- same blue blink as JenixLedState::BLE_PROVISIONING.
        return ((nowMs % 500) < 250) ? BLUE_C : OFF_C;
    }

    if (!wifiConnected) {
        return ((nowMs % 1000) < 500) ? BLUE_C : OFF_C;
    }

    // Ready-to-print heartbeat, steady green.
    return ((nowMs % 2200) < 80) ? GREEN_C : OFF_C;
}

void task(void* pv) {
    (void)pv;

    bool lastWifiConnected = false;
    bool lastWifiExpected  = false;
    PrinterState lastPrinterState = PrinterDriver::state();

    for (;;) {
        bool wifiExpected   = strlen(ConfigStore::net().wifiSsid) > 0;
        bool wifiConnected  = (WiFi.status() == WL_CONNECTED);
        PrinterState printerState = PrinterDriver::state();
        uint32_t nowMs = millis();

        if (wifiExpected && wifiConnected && (!lastWifiExpected || !lastWifiConnected)) {
            setTransient(TransientPattern::WIFI_CONNECTED);
        }

        if (lastPrinterState == PrinterState::PRINTING &&
            printerState != PrinterState::PRINTING) {
            if (printerState == PrinterState::PRINT_FAILED ||
                printerState == PrinterState::ERROR ||
                printerState == PrinterState::PAPER_OUT) {
                setTransient(TransientPattern::PRINT_FAILED);
            } else {
                setTransient(TransientPattern::PRINT_SUCCESS);
            }
        }

        RGB color = OFF_C;
        if (printerState == PrinterState::PRINTING) {
            // Printing always wins over any pending transient -- the busy
            // blink itself IS the acknowledgement.
            color = basePatternColor(nowMs);
        } else if (!consumeTransientIfActive(nowMs, color)) {
            color = basePatternColor(nowMs);
        }

        s_led.showColor(color.r, color.g, color.b);

        lastWifiExpected  = wifiExpected;
        lastWifiConnected = wifiConnected;
        lastPrinterState  = printerState;

        vTaskDelay(pdMS_TO_TICKS(20));
    }
}

} // namespace

namespace StatusLed {

void begin() {
    s_transientMtx = xSemaphoreCreateMutex();
    s_led.begin();

    xTaskCreate(task, "status_led", STACK_STATUS_LED, nullptr, 2, nullptr);
}

void signalTrigger(StatusLedTriggerSource source) {
    setTransient(source == StatusLedTriggerSource::BUTTON
                 ? TransientPattern::BUTTON_ACK
                 : TransientPattern::REMOTE_ACK);
}

} // namespace StatusLed
