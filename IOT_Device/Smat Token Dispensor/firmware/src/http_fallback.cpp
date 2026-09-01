#include "http_fallback.h"
#include "config_store.h"
#include "event_log.h"
#include <HTTPClient.h>
#include <WiFi.h>

namespace HttpFallback {

void begin() {
    // Nothing to initialize — HTTPClient is stateless
}

static bool doPost(const char* endpoint, const char* json) {
    if (WiFi.status() != WL_CONNECTED) return false;
    const char* base = ConfigStore::net().httpFallbackUrl;
    if (!base || strlen(base) == 0) return false;

    char url[512];
    snprintf(url, sizeof(url), "%s%s", base, endpoint);

    HTTPClient http;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(8000);

    int code = http.POST((uint8_t*)json, strlen(json));
    http.end();

    return (code >= 200 && code < 300);
}

bool postTelemetry(const char* json) {
    bool ok = doPost("/telemetry", json);
    if (!ok) EventLog::warn("HTTP", "HTTP telemetry fallback failed");
    return ok;
}

bool postEvent(const char* json) {
    return doPost("/event", json);
}

bool isAvailable() {
    const char* base = ConfigStore::net().httpFallbackUrl;
    return (base && strlen(base) > 0 && WiFi.status() == WL_CONNECTED);
}

} // namespace HttpFallback
