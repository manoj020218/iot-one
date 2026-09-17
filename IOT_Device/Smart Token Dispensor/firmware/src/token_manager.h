#pragma once
#include <Arduino.h>

// ---------------------------------------------------------------------------
// token_manager — Persistent token counter with wear-level NVS strategy
//
// Wear-level strategy: counter is written to NVS immediately on each token.
// On power-fail recovery the last saved value is restored.  For very high
// volume deployments (>10 M tokens) the slot-rotation approach in begin()
// can be enabled by increasing SLOT_COUNT.
// ---------------------------------------------------------------------------

namespace TokenManager {
    void begin();

    // Atomically increment and persist; returns the new formatted token string.
    // Returns false if blocked (paper out, printer busy lockout).
    bool requestNextToken();

    // Get the next token number that *will* be printed (current + 1).
    uint32_t peekNextNumber();

    // Current counter value (last printed).
    uint32_t currentNumber();
    uint32_t lastPrintedNumber();

    // Formatted token string: prefix + zero-padded number, e.g. "A0042"
    const char* currentFormatted();
    const char* lastPrintedFormatted();

    // Manually set token counter (via MQTT SET_TOKEN_COUNTER command).
    void setCounter(uint32_t value);

    // Reset counter to 0 (daily reset or FACTORY_RESET command).
    void resetCounter();

    // Called by daily-reset logic (compares RTC date).
    void checkDailyReset();

    // Mark last printed token (called by printer_driver on success).
    void confirmPrinted(uint32_t number);
}
