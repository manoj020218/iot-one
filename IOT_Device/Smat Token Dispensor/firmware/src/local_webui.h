#pragma once
#include <Arduino.h>

// ---------------------------------------------------------------------------
// local_webui — AsyncWebServer on port 80
//
// Serves static files from SPIFFS /www/ directory.
// REST API endpoints under /api/:
//   GET  /api/status          — full device status JSON
//   GET  /api/logs            — download event log JSON
//   POST /api/print/next      — trigger next token print [auth]
//   POST /api/print/test      — test print               [auth]
//   POST /api/roll/reset      — reset paper roll counter [auth]
//   POST /api/config/net      — save network config      [auth]
//   POST /api/config/dev      — save device config       [auth]
//   POST /api/token/set       — set token counter        [auth]
//   POST /api/template/upload — upload print_template.json [auth]
//   POST /api/ota/start       — start OTA from URL       [auth]
//   POST /api/logs/clear      — clear event log          [auth]
//   POST /api/factory-reset   — factory reset            [auth]
//
// [auth] = requires valid session cookie or Basic-Auth header.
// ---------------------------------------------------------------------------

namespace LocalWebUi {
    void begin();

    // Generate a new session token (returned on successful login).
    const char* generateSession();

    bool validateSession(const char* token);
    void invalidateSession(const char* token);
}
