#pragma once

#ifndef FIRMWARE_VERSION
#define FIRMWARE_VERSION "v1.0.0"
#endif

#ifndef FIRMWARE_BUILD_DATE
#define FIRMWARE_BUILD_DATE "2026-07-04"
#endif

#ifndef FIRMWARE_PID
#define FIRMWARE_PID "JNX-TD-C3-01"
#endif

#ifndef FIRMWARE_PROFILE
#define FIRMWARE_PROFILE "TOKEN_DISPENSER_C3_V1"
#endif

#ifndef BUILD_TIMESTAMP
#define BUILD_TIMESTAMP "unknown"
#endif

// ---------------------------------------------------------------------------
// Hardware pin defaults for ESP32-C3 Super Mini (HW-466AB)
// Override in config_store if you need different GPIO assignments.
// ---------------------------------------------------------------------------
#define PIN_BUTTON          4    // TTP223 touch output, active LOW
#define PIN_LED             8    // Built-in board LED, active LOW on most C3 Minis
#define PIN_LED_ACTIVE_LOW  true
#define PIN_STATUS_LED      3    // External status LED, active HIGH by default
#define PIN_STATUS_LED_ACTIVE_LOW false
#define PIN_BUZZER          5    // Optional piezo buzzer (moved off GPIO4)
#define PIN_PRINTER_TX      6    // ESP32-C3 TX → Printer RX (3.3 V TTL)
#define PIN_PRINTER_RX      7    // ESP32-C3 RX ← Printer TX (use level shifter if 5 V!)

// ---------------------------------------------------------------------------
// UART / printer
// ---------------------------------------------------------------------------
#define PRINTER_UART_NUM    1
#define PRINTER_BAUD_RATE   9600

// ---------------------------------------------------------------------------
// Timing constants (ms)
// ---------------------------------------------------------------------------
// 50ms (was 150ms) -- the print action now fires right at the debounce
// mark instead of waiting for release (see taskButton in main.cpp), so
// this value is now real, felt latency on every token print, not just a
// noise filter. 50ms is still generous for a clean tactile switch.
#define BUTTON_DEBOUNCE_MS          50
#define BUTTON_LONGPRESS_TEST_MS   5000
#define BUTTON_LONGPRESS_ROLL_MS  10000
#define PRINT_TIMEOUT_MS          15000   // Declare PRINT_FAILED after this
#define MQTT_RECONNECT_INTERVAL_MS 5000
#define TELEMETRY_INTERVAL_MS     30000
#define ESPNOW_BROADCAST_INTERVAL_MS 10000
#define WATCHDOG_TIMEOUT_S           30

// ---------------------------------------------------------------------------
// FreeRTOS task stack sizes (words = 4 bytes each)
// ---------------------------------------------------------------------------
#define STACK_BUTTON      2048
#define STACK_PRINTER     4096
#define STACK_NETWORK     8192
#define STACK_STATUS_LED  2048
#define STACK_TELEMETRY   4096
#define STACK_ESPNOW      3072
