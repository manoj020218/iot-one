#pragma once
#include <Arduino.h>

// ---------------------------------------------------------------------------
// event_log — Circular event log stored in SPIFFS
//
// Stores up to MAX_ENTRIES JSON-line records in /events.log.
// On overflow the oldest entry is dropped (ring buffer via line rotation).
// Write frequency is throttled to protect flash life.
// ---------------------------------------------------------------------------

enum class LogLevel : uint8_t {
    INFO  = 0,
    WARN  = 1,
    ERROR = 2,
};

namespace EventLog {
    void begin();

    void log(LogLevel level, const char* category, const char* message);

    inline void info (const char* cat, const char* msg) { log(LogLevel::INFO,  cat, msg); }
    inline void warn (const char* cat, const char* msg) { log(LogLevel::WARN,  cat, msg); }
    inline void error(const char* cat, const char* msg) { log(LogLevel::ERROR, cat, msg); }

    // Read all log entries as JSON array into buf (for web UI / download).
    // Returns bytes written (0 on failure).
    size_t readAll(char* buf, size_t maxLen);

    // Clear log file.
    void clear();
}
