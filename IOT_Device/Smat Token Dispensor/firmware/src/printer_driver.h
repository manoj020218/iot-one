#pragma once
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

// ---------------------------------------------------------------------------
// printer_driver — ESC/POS thermal printer over HardwareSerial (UART1)
//
// Provides a non-blocking print queue consumed by taskPrinter.
// All raw ESC/POS writes happen inside that task — never on other tasks.
// ---------------------------------------------------------------------------

enum class PrintMode : uint8_t {
    NORMAL_TOKEN  = 0,
    CUSTOM_JSON   = 1,
    TEST_PRINT    = 2,
};

struct PrintRequest {
    PrintMode mode;
    uint32_t  tokenNumber;          // For NORMAL_TOKEN
    char      customJson[512];      // For CUSTOM_JSON
    char      commandId[37];        // MQTT command_id for ack (empty if local)
};

enum class PrinterState : uint8_t {
    IDLE          = 0,
    PRINTING      = 1,
    PRINT_SUCCESS = 2,
    PRINT_FAILED  = 3,
    PAPER_LOW     = 4,
    PAPER_OUT     = 5,
    OFFLINE       = 6,
    ERROR         = 7,
};

namespace PrinterDriver {
    void begin();

    // Submit a print job — called from button task / MQTT handler.
    // Returns false if queue is full.
    bool enqueue(const PrintRequest& req);

    // FreeRTOS task function (runs forever, started by main).
    void task(void* pv);

    // Current printer state (thread-safe read).
    PrinterState state();

    // True while printer task is actively printing.
    bool isBusy();

    // Query printer status register; updates internal state.
    void pollStatus();

    // Paper status
    bool isPaperOut();
    bool isOnline();

    // Low-level ESC/POS helpers (used by print_template).
    void escReset();
    void escBold(bool on);
    void escDoubleHeight(bool on);
    void escDoubleWidth(bool on);
    void escAlign(uint8_t align);  // 0=left 1=center 2=right
    void escFeedLines(uint8_t n);
    void escCut();
    void escPrintText(const char* text);
    void escPrintQR(const char* data, uint8_t size = 6);
    void escInitAndReset();

    // Expose queue handle so other tasks can wait on it if needed.
    QueueHandle_t queue();
}
