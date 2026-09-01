#pragma once
#include <Arduino.h>

// ---------------------------------------------------------------------------
// paper_estimator — Token-count-based paper roll estimation
//
// Since the CSN-A1X does not report exact paper length remaining,
// we estimate based on tokens printed since the last roll reset.
// Paper-out is only confirmed by the hardware status bit.
// ---------------------------------------------------------------------------

namespace PaperEstimator {
    void begin();

    // Called by printer_driver after each successful print.
    void onTokenPrinted();

    // Reset counters after a new roll is installed.
    void resetRoll();

    uint32_t tokensSinceReset();
    uint32_t estimatedTokensLeft();
    bool     isPaperLow();

    // Persist current counters to NVS.
    void save();
    void load();
}
