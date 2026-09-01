#pragma once
#include <Arduino.h>

// ---------------------------------------------------------------------------
// http_fallback — HTTP POST telemetry when MQTT is unavailable
// ---------------------------------------------------------------------------

namespace HttpFallback {
    void begin();

    // Returns true if POST succeeded (HTTP 2xx).
    bool postTelemetry(const char* json);
    bool postEvent(const char* json);

    bool isAvailable(); // simple connectivity check
}
