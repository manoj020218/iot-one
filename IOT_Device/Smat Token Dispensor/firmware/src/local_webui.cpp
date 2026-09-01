#include "local_webui.h"
#include "config_store.h"
#include "token_manager.h"
#include "printer_driver.h"
#include "paper_estimator.h"
#include "print_template.h"
#include "event_log.h"
#include "mqtt_client.h"
#include "ota_service.h"
#include "espnow_service.h"
#include "status_led.h"
#include "version.h"
#include <ESPAsyncWebServer.h>
#include <SPIFFS.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <time.h>

static AsyncWebServer s_server(80);

// Simple single-session token (sufficient for a local admin UI)
static char s_sessionToken[33] = {};

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

static bool checkAuth(AsyncWebServerRequest* req) {
    // Accept the platform-standard local API token header (headless/API
    // access — same X-Jenix-Local-Token convention QRunlock uses).
    if (req->hasHeader("X-Jenix-Local-Token")) {
        const char* token = ConfigStore::net().localApiToken;
        if (strlen(token) > 0 &&
            req->header("X-Jenix-Local-Token") == token) {
            return true;
        }
    }
    // Accept session cookie
    if (req->hasHeader("Cookie")) {
        String cookies = req->header("Cookie");
        String needle  = String("jnx_session=") + s_sessionToken;
        if (strlen(s_sessionToken) > 0 && cookies.indexOf(needle) >= 0) {
            return true;
        }
    }
    // Accept Basic Auth header
    if (req->authenticate(ConfigStore::net().webUser,
                          ConfigStore::net().webPass)) {
        return true;
    }
    return false;
}

static void requireAuth(AsyncWebServerRequest* req,
                        std::function<void()> handler) {
    if (!checkAuth(req)) {
        req->requestAuthentication("Jenix Admin");
        return;
    }
    handler();
}

// ---------------------------------------------------------------------------
// Status JSON builder
// ---------------------------------------------------------------------------
static void buildStatusJson(char* buf, size_t maxLen) {
    const NetConfig& n = ConfigStore::net();
    const DevConfig& d = ConfigStore::dev();

    PrinterState ps = PrinterDriver::state();
    const char* psStr = "idle";
    switch (ps) {
        case PrinterState::PRINTING:      psStr = "printing";      break;
        case PrinterState::PRINT_SUCCESS: psStr = "print_success"; break;
        case PrinterState::PRINT_FAILED:  psStr = "print_failed";  break;
        case PrinterState::PAPER_LOW:     psStr = "paper_low";     break;
        case PrinterState::PAPER_OUT:     psStr = "paper_out";     break;
        case PrinterState::OFFLINE:       psStr = "offline";       break;
        case PrinterState::ERROR:         psStr = "error";         break;
        default:                          psStr = "idle";           break;
    }

    char dateTime[32] = "---";
    struct tm ti;
    if (getLocalTime(&ti)) {
        strftime(dateTime, sizeof(dateTime), "%Y-%m-%dT%H:%M:%S", &ti);
    }

    snprintf(buf, maxLen,
        "{"
          "\"firmware_version\":\"%s\","
          "\"firmware_build_date\":\"%s\","
          "\"pid\":\"%s\","
          "\"device_id\":\"%s\","
          "\"mac\":\"%s\","
          "\"uptime_sec\":%lu,"
          "\"date_time\":\"%s\","
          "\"wifi\":{"
            "\"status\":\"%s\","
            "\"ssid\":\"%s\","
            "\"ip\":\"%s\","
            "\"rssi\":%d"
          "},"
          "\"mqtt\":{"
            "\"connected\":%s,"
            "\"host\":\"%s\","
            "\"port\":%u"
          "},"
          "\"platform\":{"
            "\"home_id\":\"%s\","
            "\"site_name\":\"%s\""
          "},"
          "\"printer\":{"
            "\"state\":\"%s\","
            "\"online\":%s,"
            "\"paper_out\":%s"
          "},"
          "\"token\":{"
            "\"current\":%lu,"
            "\"last_printed\":%lu,"
            "\"prefix\":\"%s\""
          "},"
          "\"paper\":{"
            "\"tokens_since_reset\":%lu,"
            "\"estimated_left\":%lu,"
            "\"paper_low\":%s,"
            "\"tokens_per_roll\":%lu"
          "},"
          "\"espnow\":{\"active\":%s}"
        "}",
        FIRMWARE_VERSION, FIRMWARE_BUILD_DATE, FIRMWARE_PID,
        n.deviceId,
        WiFi.macAddress().c_str(),
        millis() / 1000,
        dateTime,
        (WiFi.status() == WL_CONNECTED) ? "connected" : "disconnected",
        n.wifiSsid,
        WiFi.localIP().toString().c_str(),
        WiFi.RSSI(),
        MqttClient::isConnected() ? "true" : "false",
        n.mqttHost,
        n.mqttPort,
        n.homeId,
        n.siteName,
        psStr,
        PrinterDriver::isOnline()  ? "true" : "false",
        PrinterDriver::isPaperOut()? "true" : "false",
        (unsigned long)TokenManager::currentNumber(),
        (unsigned long)TokenManager::lastPrintedNumber(),
        d.tokenPrefix,
        (unsigned long)PaperEstimator::tokensSinceReset(),
        (unsigned long)PaperEstimator::estimatedTokensLeft(),
        PaperEstimator::isPaperLow() ? "true" : "false",
        (unsigned long)d.tokensPerRoll,
        EspNowService::isInitialized() ? "true" : "false"
    );
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

namespace LocalWebUi {

const char* generateSession() {
    uint32_t r1 = esp_random();
    uint32_t r2 = esp_random();
    uint32_t r3 = esp_random();
    uint32_t r4 = esp_random();
    snprintf(s_sessionToken, sizeof(s_sessionToken),
             "%08lX%08lX%08lX%08lX",
             (unsigned long)r1, (unsigned long)r2,
             (unsigned long)r3, (unsigned long)r4);
    return s_sessionToken;
}

bool validateSession(const char* token) {
    return (strlen(s_sessionToken) > 0 &&
            strcmp(token, s_sessionToken) == 0);
}

void invalidateSession(const char* token) {
    (void)token;
    memset(s_sessionToken, 0, sizeof(s_sessionToken));
}

void begin() {
    // ---------------------------------------------------------------------------
    // GET /api/status — public (read-only status is not sensitive)
    // ---------------------------------------------------------------------------
    s_server.on("/api/status", HTTP_GET, [](AsyncWebServerRequest* req) {
        static char buf[2048];
        buildStatusJson(buf, sizeof(buf));
        req->send(200, "application/json", buf);
    });

    // ---------------------------------------------------------------------------
    // POST /api/login
    // ---------------------------------------------------------------------------
    s_server.on("/api/login", HTTP_POST, [](AsyncWebServerRequest* req) {
        if (req->hasParam("user", true) && req->hasParam("pass", true)) {
            String user = req->getParam("user", true)->value();
            String pass = req->getParam("pass", true)->value();
            if (user.equals(ConfigStore::net().webUser) &&
                pass.equals(ConfigStore::net().webPass)) {
                const char* tok = generateSession();
                AsyncWebServerResponse* resp =
                    req->beginResponse(200, "application/json",
                                       String("{\"ok\":true,\"token\":\"") + tok + "\"}");
                resp->addHeader("Set-Cookie",
                                String("jnx_session=") + tok +
                                "; Path=/; HttpOnly; SameSite=Strict");
                req->send(resp);
                return;
            }
        }
        req->send(401, "application/json", "{\"ok\":false,\"error\":\"invalid_credentials\"}");
    });

    // ---------------------------------------------------------------------------
    // POST /api/logout
    // ---------------------------------------------------------------------------
    s_server.on("/api/logout", HTTP_POST, [](AsyncWebServerRequest* req) {
        memset(s_sessionToken, 0, sizeof(s_sessionToken));
        AsyncWebServerResponse* resp =
            req->beginResponse(200, "application/json", "{\"ok\":true}");
        resp->addHeader("Set-Cookie",
                        "jnx_session=; Path=/; Max-Age=0; HttpOnly");
        req->send(resp);
    });

    // ---------------------------------------------------------------------------
    // GET /api/logs
    // ---------------------------------------------------------------------------
    s_server.on("/api/logs", HTTP_GET, [](AsyncWebServerRequest* req) {
        requireAuth(req, [req]() {
            static char buf[16384];
            size_t len = EventLog::readAll(buf, sizeof(buf));
            req->send(200, "application/json", len > 0 ? buf : "[]");
        });
    });

    // ---------------------------------------------------------------------------
    // POST /api/logs/clear
    // ---------------------------------------------------------------------------
    s_server.on("/api/logs/clear", HTTP_POST, [](AsyncWebServerRequest* req) {
        requireAuth(req, [req]() {
            EventLog::clear();
            req->send(200, "application/json", "{\"ok\":true}");
        });
    });

    // ---------------------------------------------------------------------------
    // POST /api/print/next
    // ---------------------------------------------------------------------------
    s_server.on("/api/print/next", HTTP_POST, [](AsyncWebServerRequest* req) {
        requireAuth(req, [req]() {
            if (PrinterDriver::isPaperOut()) {
                req->send(503, "application/json", "{\"ok\":false,\"error\":\"paper_out\"}");
                return;
            }
            if (PrinterDriver::isBusy()) {
                req->send(503, "application/json", "{\"ok\":false,\"error\":\"printer_busy\"}");
                return;
            }
            PrintRequest pr = {};
            pr.mode        = PrintMode::NORMAL_TOKEN;
            pr.tokenNumber = TokenManager::peekNextNumber();
            if (TokenManager::requestNextToken() && PrinterDriver::enqueue(pr)) {
                StatusLed::signalTrigger(StatusLedTriggerSource::REMOTE);
                MqttClient::publishActionEvent("print_next_token", "local_webui");
                req->send(200, "application/json", "{\"ok\":true}");
            } else {
                req->send(503, "application/json", "{\"ok\":false,\"error\":\"queue_full\"}");
            }
        });
    });

    // ---------------------------------------------------------------------------
    // POST /api/print/test
    // ---------------------------------------------------------------------------
    s_server.on("/api/print/test", HTTP_POST, [](AsyncWebServerRequest* req) {
        requireAuth(req, [req]() {
            PrintRequest pr = {};
            pr.mode = PrintMode::TEST_PRINT;
            if (PrinterDriver::enqueue(pr)) {
                StatusLed::signalTrigger(StatusLedTriggerSource::REMOTE);
                MqttClient::publishActionEvent("test_print", "local_webui");
                req->send(200, "application/json", "{\"ok\":true}");
            } else {
                req->send(503, "application/json", "{\"ok\":false,\"error\":\"queue_full\"}");
            }
        });
    });

    // ---------------------------------------------------------------------------
    // POST /api/roll/reset
    // ---------------------------------------------------------------------------
    s_server.on("/api/roll/reset", HTTP_POST, [](AsyncWebServerRequest* req) {
        requireAuth(req, [req]() {
            PaperEstimator::resetRoll();
            MqttClient::publishActionEvent("reset_roll_counter", "local_webui");
            req->send(200, "application/json", "{\"ok\":true}");
        });
    });

    // ---------------------------------------------------------------------------
    // POST /api/token/set   body: {"value": 42}
    // ---------------------------------------------------------------------------
    s_server.on("/api/token/set", HTTP_POST, [](AsyncWebServerRequest* req) {
        req->send(200, "application/json", "{\"ok\":true,\"note\":\"send_body\"}");
    },
    nullptr,
    [](AsyncWebServerRequest* req, uint8_t* data, size_t len,
       size_t index, size_t total) {
        requireAuth(req, [req, data, len]() {
            JsonDocument doc;
            if (deserializeJson(doc, data, len) == DeserializationError::Ok) {
                uint32_t val = doc["value"] | 0;
                TokenManager::setCounter(val);
                MqttClient::publishActionEvent("set_token_counter", "local_webui");
                req->send(200, "application/json", "{\"ok\":true}");
            } else {
                req->send(400, "application/json", "{\"ok\":false,\"error\":\"invalid_json\"}");
            }
        });
    });

    // ---------------------------------------------------------------------------
    // POST /api/config/net
    // ---------------------------------------------------------------------------
    s_server.on("/api/config/net", HTTP_POST, [](AsyncWebServerRequest* req) {
        req->send(200, "application/json", "{\"ok\":true,\"note\":\"send_body\"}");
    },
    nullptr,
    [](AsyncWebServerRequest* req, uint8_t* data, size_t len,
       size_t index, size_t total) {
        requireAuth(req, [req, data, len]() {
            JsonDocument doc;
            if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
                req->send(400, "application/json", "{\"ok\":false}");
                return;
            }
            NetConfig& n = ConfigStore::net();
            if (doc["wifiSsid"].is<const char*>()) strlcpy(n.wifiSsid, doc["wifiSsid"], 64);
            if (doc["wifiPass"].is<const char*>()) strlcpy(n.wifiPass, doc["wifiPass"], 64);
            if (doc["mqttHost"].is<const char*>()) strlcpy(n.mqttHost, doc["mqttHost"], 128);
            if (doc["mqttPort"].is<uint16_t>())    n.mqttPort = doc["mqttPort"];
            if (doc["mqttUser"].is<const char*>()) strlcpy(n.mqttUser, doc["mqttUser"], 64);
            if (doc["mqttPass"].is<const char*>()) strlcpy(n.mqttPass, doc["mqttPass"], 64);
            if (doc["homeId"].is<const char*>()) {
                strlcpy(n.homeId, doc["homeId"], sizeof(n.homeId));
            } else if (doc["tenantId"].is<const char*>()) {
                strlcpy(n.homeId, doc["tenantId"], sizeof(n.homeId));
            }
            if (doc["siteName"].is<const char*>()) {
                strlcpy(n.siteName, doc["siteName"], sizeof(n.siteName));
            } else if (doc["siteId"].is<const char*>()) {
                strlcpy(n.siteName, doc["siteId"], sizeof(n.siteName));
            }
            if (doc["httpFallbackUrl"].is<const char*>()) strlcpy(n.httpFallbackUrl, doc["httpFallbackUrl"], 256);
            ConfigStore::saveNet();
            req->send(200, "application/json", "{\"ok\":true,\"note\":\"reboot_to_apply\"}");
        });
    });

    // ---------------------------------------------------------------------------
    // POST /api/config/dev
    // ---------------------------------------------------------------------------
    s_server.on("/api/config/dev", HTTP_POST, [](AsyncWebServerRequest* req) {
        req->send(200, "application/json", "{\"ok\":true,\"note\":\"send_body\"}");
    },
    nullptr,
    [](AsyncWebServerRequest* req, uint8_t* data, size_t len,
       size_t index, size_t total) {
        requireAuth(req, [req, data, len]() {
            JsonDocument doc;
            if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
                req->send(400, "application/json", "{\"ok\":false}");
                return;
            }
            DevConfig& d = ConfigStore::dev();
            if (doc["tokenPrefix"].is<const char*>())   strlcpy(d.tokenPrefix, doc["tokenPrefix"], 16);
            if (doc["dailyResetHour"].is<uint32_t>())   d.dailyResetHour    = doc["dailyResetHour"];
            if (doc["tokensPerRoll"].is<uint32_t>())    d.tokensPerRoll     = doc["tokensPerRoll"];
            if (doc["lowPaperThreshold"].is<uint32_t>())d.lowPaperThreshold = doc["lowPaperThreshold"];
            if (doc["buzzerEnabled"].is<bool>())        d.buzzerEnabled     = doc["buzzerEnabled"];
            ConfigStore::saveDev();
            req->send(200, "application/json", "{\"ok\":true}");
        });
    });

    // ---------------------------------------------------------------------------
    // POST /api/template/upload — body = raw JSON of template
    // ---------------------------------------------------------------------------
    s_server.on("/api/template/upload", HTTP_POST, [](AsyncWebServerRequest* req) {
        req->send(200, "application/json", "{\"ok\":true,\"note\":\"send_body\"}");
    },
    nullptr,
    [](AsyncWebServerRequest* req, uint8_t* data, size_t len,
       size_t index, size_t total) {
        requireAuth(req, [req, data, len]() {
            bool ok = PrintTemplate::saveJson((const char*)data, len);
            if (ok) {
                req->send(200, "application/json", "{\"ok\":true}");
            } else {
                req->send(400, "application/json", "{\"ok\":false,\"error\":\"invalid_template\"}");
            }
        });
    });

    // ---------------------------------------------------------------------------
    // GET /api/template — download current template
    // ---------------------------------------------------------------------------
    s_server.on("/api/template", HTTP_GET, [](AsyncWebServerRequest* req) {
        requireAuth(req, [req]() {
            static char buf[4096];
            if (PrintTemplate::getJson(buf, sizeof(buf))) {
                req->send(200, "application/json", buf);
            } else {
                req->send(404, "application/json", "{\"error\":\"template_not_found\"}");
            }
        });
    });

    // ---------------------------------------------------------------------------
    // POST /api/ota/start   body: {"url":"https://..."}
    // ---------------------------------------------------------------------------
    s_server.on("/api/ota/start", HTTP_POST, [](AsyncWebServerRequest* req) {
        req->send(200, "application/json", "{\"ok\":true,\"note\":\"send_body\"}");
    },
    nullptr,
    [](AsyncWebServerRequest* req, uint8_t* data, size_t len,
       size_t index, size_t total) {
        requireAuth(req, [req, data, len]() {
            JsonDocument doc;
            if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
                req->send(400, "application/json", "{\"ok\":false}");
                return;
            }
            const char* url = doc["url"] | "";
            if (strlen(url) == 0) {
                req->send(400, "application/json", "{\"ok\":false,\"error\":\"url_required\"}");
                return;
            }
            req->send(202, "application/json", "{\"ok\":true,\"note\":\"ota_starting\"}");
            vTaskDelay(pdMS_TO_TICKS(200));
            OtaService::startHttpOta(url);
        });
    });

    // ---------------------------------------------------------------------------
    // POST /api/factory-reset
    // ---------------------------------------------------------------------------
    s_server.on("/api/factory-reset", HTTP_POST, [](AsyncWebServerRequest* req) {
        requireAuth(req, [req]() {
            req->send(200, "application/json", "{\"ok\":true,\"note\":\"rebooting\"}");
            vTaskDelay(pdMS_TO_TICKS(500));
            ConfigStore::factoryReset();
            ESP.restart();
        });
    });

    // ---------------------------------------------------------------------------
    // POST /api/reboot
    // ---------------------------------------------------------------------------
    s_server.on("/api/reboot", HTTP_POST, [](AsyncWebServerRequest* req) {
        requireAuth(req, [req]() {
            req->send(200, "application/json", "{\"ok\":true}");
            vTaskDelay(pdMS_TO_TICKS(500));
            ESP.restart();
        });
    });

    // ---------------------------------------------------------------------------
    // Static files from SPIFFS /www/
    // ---------------------------------------------------------------------------
    s_server.serveStatic("/", SPIFFS, "/www/").setDefaultFile("index.html");

    // 404 fallback
    s_server.onNotFound([](AsyncWebServerRequest* req) {
        req->send(404, "text/plain", "Not found");
    });

    s_server.begin();
    EventLog::info("WEBUI", "HTTP server started on port 80");
}

} // namespace LocalWebUi
