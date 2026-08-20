#pragma once

#include <Arduino.h>

namespace systemtime {

// Starts (or re-arms) SNTP sync against public NTP servers. Safe to call
// repeatedly — configTime() is idempotent. Call once Wi-Fi is up; cloud ack/
// status payloads need a real wall-clock time, not just millis() uptime.
void Begin();

// True once SNTP has produced a plausible wall-clock time (year > 2020).
// Ack/status payloads fall back to a millis()-based placeholder timestamp
// until this is true, rather than sending an obviously-wrong 1970 date.
bool Synced();

// Fills `out` with the current UTC time as "YYYY-MM-DDTHH:MM:SSZ" (24
// bytes + null). If not yet synced, falls back to
// "1970-01-01T00:00:00Z" — callers that care should check Synced() first.
void NowIso8601(char* out, size_t outSize);

}  // namespace systemtime
