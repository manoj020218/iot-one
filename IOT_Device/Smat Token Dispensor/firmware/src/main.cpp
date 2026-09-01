// ===========================================================================
// Jenix Smart Token Dispenser — JNX-TD-C3-01
// ESP32-C3 Super Mini (HW-466AB)
// Jenix One IoT Platform  |  PID: JNX-TD-C3-01  |  v1.0.0
// ===========================================================================

#include <Arduino.h>
#include <WiFi.h>
#ifndef JENIX_PROV_V2
#include <ESPmDNS.h>
#endif
#include <SPIFFS.h>
#include <esp_task_wdt.h>
#include <time.h>

#include "version.h"
#include "config_store.h"
#include "token_manager.h"
#include "printer_driver.h"
#include "print_template.h"
#include "paper_estimator.h"
#include "event_log.h"
#include "mqtt_client.h"
#include "http_fallback.h"
#include "espnow_service.h"
#ifdef JENIX_PROV_V2
#include "provisioning2.h"
#define ProvisioningImpl Provisioning2
#else
#include "ble_provisioning.h"
#define ProvisioningImpl BleProvisioning
#endif
#include "ota_service.h"
#include "local_webui.h"
#include "status_led.h"

// ---------------------------------------------------------------------------
// AP mode configuration
// ---------------------------------------------------------------------------
#define AP_SSID_PREFIX   "JNX-TD-"
#define AP_PASS          ""          // Open AP (user must login via web UI)
#define AP_CHANNEL       1
#define NTP_SERVER       "pool.ntp.org"
#define NTP_TZ_OFFSET    19800       // IST UTC+5:30 in seconds (adjust per deployment)

// ---------------------------------------------------------------------------
// Button state machine
// ---------------------------------------------------------------------------
enum class ButtonState { IDLE, DEBOUNCING, HELD };

// ---------------------------------------------------------------------------
// Global device state (read by all tasks, written by printer task)
// ---------------------------------------------------------------------------
static volatile bool g_apMode     = false;
static volatile bool g_wifiOk     = false;

// LED control helper
static void setLed(bool on) {
    bool level = PIN_LED_ACTIVE_LOW ? !on : on;
    digitalWrite(PIN_LED, level);
}

static void ledBlink(int times, int onMs = 100, int offMs = 100) {
    for (int i = 0; i < times; i++) {
        setLed(true);
        vTaskDelay(pdMS_TO_TICKS(onMs));
        setLed(false);
        vTaskDelay(pdMS_TO_TICKS(offMs));
    }
}

// ---------------------------------------------------------------------------
// WiFi management
// ---------------------------------------------------------------------------
// Build AP SSID from MAC
static void buildApSsid(char* buf, size_t len) {
    uint8_t mac[6];
    WiFi.macAddress(mac);
    snprintf(buf, len, "%s%02X%02X", AP_SSID_PREFIX, mac[4], mac[5]);
}

static void startMdns() {
#ifndef JENIX_PROV_V2
    uint8_t mac[6];
    WiFi.macAddress(mac);
    char hostname[20];
    snprintf(hostname, sizeof(hostname), "jnx-td-%02x%02x", mac[4], mac[5]);
    if (MDNS.begin(hostname)) {
        MDNS.addService("http", "tcp", 80);
        char msg[48];
        snprintf(msg, sizeof(msg), "mDNS: http://%s.local", hostname);
        EventLog::info("MDNS", msg);
    }
#endif
}

static void startAP() {
    char apSsid[24];
    buildApSsid(apSsid, sizeof(apSsid));

    WiFi.mode(WIFI_AP_STA);
    // ESP32-C3 Super Mini PCB antenna works best at 8.5 dBm;
    // higher power causes antenna mismatch and AP is invisible to clients.
    WiFi.setTxPower(WIFI_POWER_8_5dBm);
    delay(100); // let mode + power settle before softAP

    WiFi.softAP(apSsid, AP_PASS, AP_CHANNEL);
    delay(200); // let AP beacon propagate

    char msg[96];
    snprintf(msg, sizeof(msg), "AP started: SSID=%s IP=%s TxPwr=8.5dBm",
             apSsid, WiFi.softAPIP().toString().c_str());
    EventLog::info("WIFI", msg);
    g_apMode = true;
}

static void connectWifi() {
    const NetConfig& n = ConfigStore::net();
    if (strlen(n.wifiSsid) == 0) {
        EventLog::warn("WIFI", "No WiFi SSID configured — starting AP only");
        startAP();
        return;
    }

    EventLog::info("WIFI", "Connecting to WiFi...");
    WiFi.mode(WIFI_AP_STA);
    WiFi.setTxPower(WIFI_POWER_8_5dBm);
    delay(100);

    // AP runs in parallel for local access while STA connects
    char apSsid[24];
    buildApSsid(apSsid, sizeof(apSsid));
    WiFi.softAP(apSsid, AP_PASS, AP_CHANNEL);
    delay(200);

    WiFi.begin(n.wifiSsid, n.wifiPass);
}

// ---------------------------------------------------------------------------
// TASK: Button
// Priority 3 — reads GPIO, debounces, handles short/long press
// ---------------------------------------------------------------------------
static void triggerNormalPrint() {
    if (PrinterDriver::isPaperOut()) {
        EventLog::warn("BUTTON", "Print blocked: paper out");
        return;
    }

    if (!PrinterDriver::isBusy() || ConfigStore::dev().queueOneBusy) {
        PrintRequest req = {};
        req.mode        = PrintMode::NORMAL_TOKEN;
        req.tokenNumber = TokenManager::peekNextNumber();
        if (TokenManager::requestNextToken()) {
            if (PrinterDriver::enqueue(req)) {
                MqttClient::publishActionEvent("print_next_token", "button");
            }
        }
    }
}

static void taskButton(void* pv) {
    esp_task_wdt_add(nullptr);
    ButtonState bst     = ButtonState::IDLE;
    uint32_t    pressMs = 0;
    bool        longTestFired = false;
    bool        longRollFired = false;

    for (;;) {
        bool btnDown = (digitalRead(PIN_BUTTON) == LOW); // active LOW

        switch (bst) {
            case ButtonState::IDLE:
                if (btnDown) {
                    bst     = ButtonState::DEBOUNCING;
                    pressMs = millis();
                    longTestFired = false;
                    longRollFired = false;
                    // Instant "input received" feedback, before debounce
                    // even confirms it's a real press — a printer job still
                    // takes real time to run, so this is what keeps a user
                    // from assuming the button didn't register and
                    // pressing again. Self-corrects on the LED task's next
                    // tick if this turns out to be noise.
                    StatusLed::signalTrigger(StatusLedTriggerSource::BUTTON);
                }
                break;

            case ButtonState::DEBOUNCING:
                if (!btnDown) {
                    // Released before debounce settled — noise, ignore.
                    bst = ButtonState::IDLE;
                } else if (millis() - pressMs >= BUTTON_DEBOUNCE_MS) {
                    // Confirmed press — fire the normal-print action right
                    // here instead of waiting for release. Waiting for
                    // release added however long the user's own press
                    // happened to last (100-300ms+) on top of the debounce
                    // window before the printer ever started, which is
                    // exactly the perceived lag that caused repeat presses.
                    // Trade-off: a deliberate long-press (test print / roll
                    // reset, staff-only actions) now also fires one normal
                    // print at the debounce mark, since we can't know yet
                    // it'll become a long press — acceptable for a rare,
                    // deliberate admin action in exchange for the common
                    // case (a customer tapping for a token) responding
                    // immediately.
                    bst = ButtonState::HELD;
                    triggerNormalPrint();
                }
                break;

            case ButtonState::HELD: {
                uint32_t heldMs = millis() - pressMs;

                if (!btnDown) {
                    // Released — the short-press action (if any) already
                    // fired back in DEBOUNCING, nothing to do here.
                    bst = ButtonState::IDLE;
                    break;
                }

                // 5-second long press — test print
                if (!longTestFired && heldMs >= BUTTON_LONGPRESS_TEST_MS) {
                    longTestFired = true;
                    PrintRequest req = {};
                    req.mode = PrintMode::TEST_PRINT;
                    if (PrinterDriver::enqueue(req)) {
                        StatusLed::signalTrigger(StatusLedTriggerSource::BUTTON);
                        MqttClient::publishActionEvent("test_print", "button");
                        EventLog::info("BUTTON", "Long press 5s: test print");
                    }
                }

                // 10-second long press — reset paper roll (if enabled)
                if (!longRollFired && heldMs >= BUTTON_LONGPRESS_ROLL_MS) {
                    longRollFired = true;
                    if (ConfigStore::dev().longPressRollReset) {
                        PaperEstimator::resetRoll();
                        MqttClient::publishActionEvent("reset_roll_counter", "button");
                        EventLog::info("BUTTON", "Long press 10s: roll counter reset");
                    }
                }
                break;
            }
        }

        vTaskDelay(pdMS_TO_TICKS(20));
        esp_task_wdt_reset();
    }
}

// ---------------------------------------------------------------------------
// TASK: Network — WiFi reconnect, MQTT loop, OTA loop
// Priority 2
// ---------------------------------------------------------------------------
static void taskNetwork(void* pv) {
    esp_task_wdt_add(nullptr);
    uint32_t lastWifiCheck = 0;

    for (;;) {
        uint32_t now = millis();

        // WiFi reconnect
        if (now - lastWifiCheck > 10000) {
            lastWifiCheck = now;
            bool wifiConnected = (WiFi.status() == WL_CONNECTED);

            if (!wifiConnected && strlen(ConfigStore::net().wifiSsid) > 0) {
                EventLog::warn("WIFI", "WiFi lost — reconnecting");
                WiFi.reconnect();
                g_wifiOk = false;
            } else if (wifiConnected && !g_wifiOk) {
                g_wifiOk = true;
                char msg[64];
                snprintf(msg, sizeof(msg), "WiFi connected: %s",
                         WiFi.localIP().toString().c_str());
                EventLog::info("WIFI", msg);

                // Sync NTP on first connection
                configTime(NTP_TZ_OFFSET, 0, NTP_SERVER);
            }
        }

        // MQTT loop (handles reconnect and message dispatch)
        MqttClient::loop();

        // ArduinoOTA loop
        OtaService::loop();

        vTaskDelay(pdMS_TO_TICKS(50));
        esp_task_wdt_reset();
    }
}

// ---------------------------------------------------------------------------
// TASK: Telemetry — periodic publish to MQTT / HTTP fallback + ESP-NOW
// Priority 1
// ---------------------------------------------------------------------------
static void taskTelemetry(void* pv) {
    esp_task_wdt_add(nullptr);
    char buf[1024];
    uint32_t lastTelemetry = 0;
    uint32_t lastEspNow    = 0;

    for (;;) {
        uint32_t now = millis();

        // Check daily reset
        TokenManager::checkDailyReset();

        if (now - lastTelemetry > TELEMETRY_INTERVAL_MS) {
            lastTelemetry = now;

            // Build telemetry JSON matching Jenix One telemetry contract
            snprintf(buf, sizeof(buf),
                "{"
                  "\"deviceId\":\"%s\","
                  "\"pid\":\"%s\","
                  "\"ts\":%lu,"
                  "\"currentToken\":%lu,"
                  "\"lastPrintedToken\":%lu,"
                  "\"printerState\":%u,"
                  "\"paperLow\":%s,"
                  "\"estimatedTokensLeft\":%lu,"
                  "\"paperOut\":%s,"
                  "\"wifi_rssi\":%d,"
                  "\"uptime_sec\":%lu,"
                  "\"firmware_version\":\"%s\""
                "}",
                ConfigStore::net().deviceId,
                FIRMWARE_PID,
                (unsigned long)(millis() / 1000),
                (unsigned long)TokenManager::currentNumber(),
                (unsigned long)TokenManager::lastPrintedNumber(),
                (uint8_t)PrinterDriver::state(),
                PaperEstimator::isPaperLow() ? "true" : "false",
                (unsigned long)PaperEstimator::estimatedTokensLeft(),
                PrinterDriver::isPaperOut() ? "true" : "false",
                WiFi.RSSI(),
                (unsigned long)(millis() / 1000),
                FIRMWARE_VERSION
            );

            if (MqttClient::isConnected()) {
                // Retained on the canonical .../status topic, not .../telemetry —
                // the platform's MQTT bridge reserves .../telemetry for its own
                // internal scene-job relay (HTTP-ingested telemetry republished
                // for cross-instance fanout), not raw device-published JSON. See
                // canonicalStatusHandlersByPid in runtime.handlers.ts.
                MqttClient::publishState(buf);
            } else if (HttpFallback::isAvailable()) {
                HttpFallback::postTelemetry(buf);
            }

            // Paper low alert event
            if (PaperEstimator::isPaperLow()) {
                char alertJson[96];
                snprintf(alertJson, sizeof(alertJson),
                         "{\"type\":\"PAPER_LOW\",\"estimatedTokensLeft\":%lu}",
                         (unsigned long)PaperEstimator::estimatedTokensLeft());
                if (MqttClient::isConnected()) {
                    MqttClient::publishEvent(alertJson);
                }
            }
        }

        // ESP-NOW broadcast
        if (now - lastEspNow > ESPNOW_BROADCAST_INTERVAL_MS) {
            lastEspNow = now;
            EspNowService::broadcastStatus();
        }

        vTaskDelay(pdMS_TO_TICKS(1000));
        esp_task_wdt_reset();
    }
}

// ---------------------------------------------------------------------------
// setup()
// ---------------------------------------------------------------------------
void setup() {
    // Serial (USB CDC) for debug
    Serial.begin(115200);
    delay(500);
    Serial.printf("\n\n== Jenix Token Dispenser %s ==\n", FIRMWARE_VERSION);
    Serial.printf("   PID: %s  Build: %s\n\n", FIRMWARE_PID, FIRMWARE_BUILD_DATE);

    // GPIO
    pinMode(PIN_LED,    OUTPUT);
    pinMode(PIN_BUTTON, INPUT_PULLUP);
    setLed(true); // LED on during boot

    // SPIFFS
    if (!SPIFFS.begin(true)) {
        Serial.println("SPIFFS mount failed — formatting...");
        SPIFFS.format();
        SPIFFS.begin(true);
    }

    // Core modules (order matters: config → log → token → paper)
    ConfigStore::begin();
    bool generatedLocalApiToken = false;
    ConfigStore::ensureLocalApiToken(&generatedLocalApiToken);
    Serial.printf(
        generatedLocalApiToken
            ? "[SECURITY] Generated local API token header %s value %s\r\n"
            : "[SECURITY] Local API token source=stored header=%s value=%s\r\n",
        "X-Jenix-Local-Token", ConfigStore::net().localApiToken);
    EventLog::begin();
    EventLog::info("BOOT", "Firmware started: " FIRMWARE_VERSION " PID=" FIRMWARE_PID);

    TokenManager::begin();
    PaperEstimator::begin();
    if (ConfigStore::dev().buzzerEnabled) {
        pinMode(PIN_BUZZER, OUTPUT);
    }

    // Printer
    PrinterDriver::begin();
    PrintTemplate::load();
    StatusLed::begin();

    // Network
    WiFi.setHostname(ConfigStore::net().deviceId);
    connectWifi();
    startMdns();

    // BLE provisioning (runs for BLE_WINDOW_MS or until provisioned)
    ProvisioningImpl::begin();
#ifdef JENIX_PROV_V2
    // Factory-flash boot log line — parsed by FlashTool/capture.py's BOOT_RE.
    Serial.printf("Boot PID=%s AP/BLE=%s CPU=%luMHz\r\n",
                  FIRMWARE_PID, Provisioning2::bleName(), (unsigned long)getCpuFrequencyMhz());
#endif

    // ESP-NOW
    EspNowService::begin();

    // MQTT
    MqttClient::begin();

    // OTA
    OtaService::begin();

    // Web UI
    LocalWebUi::begin();

    // Watchdog — 30 second timeout, panic on expire
    // Use legacy API compatible with ESP32 Arduino framework 3.x
#ifdef JENIX_PROV_V2
    esp_task_wdt_config_t watchdogConfig = {};
    watchdogConfig.timeout_ms = WATCHDOG_TIMEOUT_S * 1000;
    watchdogConfig.idle_core_mask = 1;
    watchdogConfig.trigger_panic = true;
    esp_task_wdt_init(&watchdogConfig);
#else
    esp_task_wdt_init(WATCHDOG_TIMEOUT_S, true);
#endif

    setLed(false);
    EventLog::info("BOOT", "All modules initialized");

    // ---------------------------------------------------------------------------
    // FreeRTOS tasks
    // Printer task runs at highest priority so it is not starved.
    // Network task at 2 for responsive reconnect.
    // Button at 3 so press latency is low.
    // Telemetry at 1 — not time-critical.
    // ---------------------------------------------------------------------------
    xTaskCreate(taskButton,    "button",    STACK_BUTTON,    nullptr, 3, nullptr);
    xTaskCreate(PrinterDriver::task, "printer", STACK_PRINTER, nullptr, 4, nullptr);
    xTaskCreate(taskNetwork,   "network",   STACK_NETWORK,   nullptr, 2, nullptr);
    xTaskCreate(taskTelemetry, "telemetry", STACK_TELEMETRY, nullptr, 1, nullptr);

    Serial.println("Tasks started. Entering loop.");
}

// ---------------------------------------------------------------------------
// loop() — minimal; real work done in FreeRTOS tasks
// ---------------------------------------------------------------------------
void loop() {
    // BLE provisioning auto-stop
    ProvisioningImpl::isActive(); // checks timeout internally

#ifdef JENIX_PROV_V2
    // wifi_prov_mgr forces esp_wifi_set_mode(WIFI_MODE_STA) both when
    // provisioning starts and again when credentials are received
    // (manager.c), which would silently kill the always-on local-config
    // SoftAP that connectWifi()/startAP() set up. Restore AP+STA mode if the
    // manager reset it away — the BLE radio is independent of this, so this
    // doesn't interfere with the provisioning session itself.
    if (WiFi.getMode() != WIFI_MODE_APSTA) {
        char apSsid[24];
        buildApSsid(apSsid, sizeof(apSsid));
        WiFi.mode(WIFI_AP_STA);
        WiFi.setTxPower(WIFI_POWER_8_5dBm);
        WiFi.softAP(apSsid, AP_PASS, AP_CHANNEL);
    }
#endif

    vTaskDelay(pdMS_TO_TICKS(1000));
}
