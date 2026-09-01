#include "print_template.h"
#include "printer_driver.h"
#include "version.h"
#include "event_log.h"
#include <SPIFFS.h>
#include <ArduinoJson.h>

#define TEMPLATE_PATH  "/print_template.json"
#define MAX_JSON_SIZE  4096

static JsonDocument s_tmpl;
static bool         s_loaded = false;

// ---------------------------------------------------------------------------
// Variable substitution helper
// Replaces {{variable}} tokens in src into dst.
// ---------------------------------------------------------------------------
static void substitute(const char* src, char* dst, size_t dstLen,
                        const PrintContext& ctx)
{
    size_t si = 0, di = 0;
    size_t srcLen = strlen(src);

    while (si < srcLen && di < dstLen - 1) {
        if (src[si] == '{' && src[si+1] == '{') {
            // Find closing }}
            const char* end = strstr(src + si + 2, "}}");
            if (!end) { dst[di++] = src[si++]; continue; }

            size_t varLen = end - (src + si + 2);
            char varName[64] = {};
            if (varLen < sizeof(varName)) {
                memcpy(varName, src + si + 2, varLen);
            }

            const char* value = "";
            if      (strcmp(varName, "token_number")         == 0) value = ctx.tokenNumber;
            else if (strcmp(varName, "date_time")            == 0) value = ctx.dateTime;
            else if (strcmp(varName, "queue_name")           == 0) value = ctx.queueName;
            else if (strcmp(varName, "site_name")            == 0) value = ctx.siteName;
            else if (strcmp(varName, "custom_header")        == 0) value = ctx.customHeader;
            else if (strcmp(varName, "custom_footer")        == 0) value = ctx.customFooter;
            else if (strcmp(varName, "qr_payload")           == 0) value = ctx.qrPayload;
            else if (strcmp(varName, "linked_device_message")== 0) value = ctx.linkedDeviceMessage;
            else if (strcmp(varName, "action_reason")        == 0) value = ctx.actionReason;
            else if (strcmp(varName, "firmware_version")     == 0) value = FIRMWARE_VERSION;
            else if (strcmp(varName, "pid")                  == 0) value = FIRMWARE_PID;

            size_t vLen = strlen(value);
            if (di + vLen < dstLen - 1) {
                memcpy(dst + di, value, vLen);
                di += vLen;
            }
            si = (end - src) + 2; // skip past }}
        } else {
            dst[di++] = src[si++];
        }
    }
    dst[di] = 0;
}

// ---------------------------------------------------------------------------
// Apply a single template element to the printer
// ---------------------------------------------------------------------------
static void applyElement(JsonObjectConst elem, const PrintContext* ctx) {
    const char* type = elem["type"] | "";

    if (strcmp(type, "text") == 0) {
        const char* text  = elem["content"] | "";
        uint8_t     align = elem["align"]   | 0;     // 0=L 1=C 2=R
        bool        bold  = elem["bold"]    | false;
        bool        dblH  = elem["double_height"] | false;
        bool        dblW  = elem["double_width"]  | false;

        PrinterDriver::escAlign(align);
        PrinterDriver::escBold(bold);
        PrinterDriver::escDoubleHeight(dblH);
        PrinterDriver::escDoubleWidth(dblW);

        if (ctx) {
            char expanded[256];
            substitute(text, expanded, sizeof(expanded), *ctx);
            PrinterDriver::escPrintText(expanded);
        } else {
            PrinterDriver::escPrintText(text);
        }

        // Reset formatting after text
        PrinterDriver::escBold(false);
        PrinterDriver::escDoubleHeight(false);
        PrinterDriver::escDoubleWidth(false);

    } else if (strcmp(type, "feed") == 0) {
        uint8_t lines = elem["lines"] | 1;
        PrinterDriver::escFeedLines(lines);

    } else if (strcmp(type, "cut") == 0) {
        PrinterDriver::escCut();

    } else if (strcmp(type, "qr") == 0) {
        const char* data = elem["content"] | "";
        uint8_t     size = elem["size"]    | 6;
        if (ctx) {
            char expanded[256];
            substitute(data, expanded, sizeof(expanded), *ctx);
            PrinterDriver::escPrintQR(expanded, size);
        } else {
            PrinterDriver::escPrintQR(data, size);
        }

    } else if (strcmp(type, "divider") == 0) {
        PrinterDriver::escAlign(0);
        PrinterDriver::escPrintText("--------------------------------");
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

namespace PrintTemplate {

bool load() {
    File f = SPIFFS.open(TEMPLATE_PATH, "r");
    if (!f) {
        EventLog::warn("TEMPLATE", "print_template.json not found — using defaults");
        s_loaded = false;
        return false;
    }

    DeserializationError err = deserializeJson(s_tmpl, f);
    f.close();

    if (err) {
        EventLog::error("TEMPLATE", "JSON parse error in print_template.json");
        s_loaded = false;
        return false;
    }

    s_loaded = true;
    EventLog::info("TEMPLATE", "print_template.json loaded");
    return true;
}

bool reload() {
    s_tmpl.clear();
    s_loaded = false;
    return load();
}

bool isLoaded() { return s_loaded; }

void render(const PrintContext& ctx) {
    PrinterDriver::escInitAndReset();

    if (!s_loaded) {
        // Built-in fallback template
        PrinterDriver::escAlign(1); // center
        PrinterDriver::escBold(true);
        PrinterDriver::escDoubleHeight(true);
        PrinterDriver::escPrintText("YOUR TOKEN");
        PrinterDriver::escBold(false);
        PrinterDriver::escDoubleHeight(false);
        PrinterDriver::escDoubleWidth(true);
        PrinterDriver::escPrintText(ctx.tokenNumber);
        PrinterDriver::escDoubleWidth(false);
        PrinterDriver::escPrintText(ctx.dateTime);
        PrinterDriver::escFeedLines(3);
        PrinterDriver::escCut();
        return;
    }

    JsonArrayConst elements = s_tmpl["elements"].as<JsonArrayConst>();
    for (JsonObjectConst elem : elements) {
        applyElement(elem, &ctx);
    }
}

void renderTest() {
    PrinterDriver::escInitAndReset();
    PrinterDriver::escAlign(1);
    PrinterDriver::escBold(true);
    PrinterDriver::escPrintText("*** TEST PRINT ***");
    PrinterDriver::escBold(false);
    PrinterDriver::escPrintText(FIRMWARE_PID);
    PrinterDriver::escPrintText(FIRMWARE_VERSION);
    PrinterDriver::escPrintText(FIRMWARE_BUILD_DATE);
    PrinterDriver::escFeedLines(2);
    PrinterDriver::escAlign(0);
    PrinterDriver::escPrintText("Printer OK");
    PrinterDriver::escFeedLines(3);
    PrinterDriver::escCut();
}

void renderCustom(const char* jsonPayload) {
    if (!jsonPayload || strlen(jsonPayload) == 0) return;

    JsonDocument doc;
    if (deserializeJson(doc, jsonPayload) != DeserializationError::Ok) {
        EventLog::error("TEMPLATE", "renderCustom: invalid JSON payload");
        return;
    }

    PrinterDriver::escInitAndReset();

    // Custom payload may have "elements" array (same schema as template)
    // or plain "text" field for simple messages
    if (doc["elements"].is<JsonArray>()) {
        PrintContext emptyCtx = {};
        JsonArrayConst elements = doc["elements"].as<JsonArrayConst>();
        for (JsonObjectConst elem : elements) {
            applyElement(elem, &emptyCtx);
        }
    } else if (doc["text"].is<const char*>()) {
        PrinterDriver::escPrintText(doc["text"] | "");
        PrinterDriver::escFeedLines(3);
        PrinterDriver::escCut();
    }
}

bool getJson(char* buf, size_t maxLen) {
    File f = SPIFFS.open(TEMPLATE_PATH, "r");
    if (!f) return false;
    size_t len = f.readBytes(buf, maxLen - 1);
    f.close();
    buf[len] = 0;
    return len > 0;
}

bool saveJson(const char* json, size_t len) {
    // Validate JSON before saving
    JsonDocument test;
    if (deserializeJson(test, json, len) != DeserializationError::Ok) {
        EventLog::error("TEMPLATE", "saveJson: invalid JSON — not saved");
        return false;
    }

    File f = SPIFFS.open(TEMPLATE_PATH, "w");
    if (!f) return false;
    f.write((const uint8_t*)json, len);
    f.close();

    EventLog::info("TEMPLATE", "print_template.json updated");
    return reload();
}

} // namespace PrintTemplate
