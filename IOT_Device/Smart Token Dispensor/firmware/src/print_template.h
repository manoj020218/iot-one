#pragma once
#include <Arduino.h>

// ---------------------------------------------------------------------------
// print_template — JSON-driven ESC/POS template engine
//
// Loads /print_template.json from SPIFFS.
// Template variables substituted at print time:
//   {{token_number}}, {{date_time}}, {{queue_name}}, {{site_name}},
//   {{custom_header}}, {{custom_footer}}, {{qr_payload}},
//   {{linked_device_message}}, {{action_reason}}
// ---------------------------------------------------------------------------

struct PrintContext {
    char tokenNumber[16];
    char dateTime[32];
    char queueName[64];
    char siteName[64];
    char customHeader[128];
    char customFooter[128];
    char qrPayload[256];
    char linkedDeviceMessage[128];
    char actionReason[128];
};

namespace PrintTemplate {
    // Load template from SPIFFS. Call after SPIFFS.begin().
    bool load();

    // Reload template from SPIFFS (after upload via web UI).
    bool reload();

    // Execute template: renders to printer via PrinterDriver ESC/POS calls.
    void render(const PrintContext& ctx);

    // Render a test page.
    void renderTest();

    // Render from a custom JSON payload (PRINT_CUSTOM_JSON command).
    void renderCustom(const char* jsonPayload);

    // True if template is loaded.
    bool isLoaded();

    // Return template JSON as string (for web UI download).
    bool getJson(char* buf, size_t maxLen);

    // Save new template JSON (from web UI or MQTT SET_TEMPLATE).
    bool saveJson(const char* json, size_t len);
}
