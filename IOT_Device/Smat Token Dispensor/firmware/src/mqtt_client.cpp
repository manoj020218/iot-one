#include "mqtt_client.h"
#include "version.h"
#include "config_store.h"
#include "event_log.h"
#include "token_manager.h"
#include "printer_driver.h"
#include "print_template.h"
#include "paper_estimator.h"
#include "ota_service.h"
#include "status_led.h"
#include <PubSubClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <time.h>

static WiFiClient   s_wifiClient;
static PubSubClient s_mqtt(s_wifiClient);

static char s_topicStatus[192];
static char s_topicCommand[192];
static char s_topicCommandAck[192];
static char s_topicEvents[192];
static char s_topicLwt[192];

static int buildTopic(char* out, size_t outSize, const char* homeId,
                      const char* deviceId, const char* suffix) {
    return snprintf(out, outSize, "jnx/%s/%s/%s/%s",
                    homeId, FIRMWARE_PID, deviceId, suffix);
}

static void buildTopics() {
    const NetConfig& n = ConfigStore::net();
    buildTopic(s_topicStatus, sizeof(s_topicStatus), n.homeId, n.deviceId, "status");
    buildTopic(s_topicCommand, sizeof(s_topicCommand), n.homeId, n.deviceId, "cmd");
    buildTopic(s_topicCommandAck, sizeof(s_topicCommandAck), n.homeId, n.deviceId, "cmd/ack");
    buildTopic(s_topicEvents, sizeof(s_topicEvents), n.homeId, n.deviceId, "events");
    buildTopic(s_topicLwt, sizeof(s_topicLwt), n.homeId, n.deviceId, "lwt");
}

static void buildIsoTimestamp(char* out, size_t outSize) {
    struct tm ti;
    if (getLocalTime(&ti)) {
        strftime(out, outSize, "%Y-%m-%dT%H:%M:%S", &ti);
        return;
    }
    snprintf(out, outSize, "uptime-%lu", (unsigned long)(millis() / 1000));
}

static bool copyJsonVariant(JsonVariantConst value, char* out, size_t outSize) {
    out[0] = '\0';
    if (value.isNull()) return false;
    if (value.is<const char*>()) {
        strlcpy(out, value.as<const char*>(), outSize);
        return true;
    }

    size_t written = serializeJson(value, out, outSize);
    return written > 0 && written < outSize;
}

static const char* getPayloadString(JsonVariantConst payload, JsonDocument& doc, const char* key) {
    if (payload.is<JsonObjectConst>() && payload[key].is<const char*>()) {
        return payload[key];
    }
    return doc[key] | "";
}

static uint32_t getPayloadUint(JsonVariantConst payload, JsonDocument& doc, const char* key) {
    if (payload.is<JsonObjectConst>() && payload[key].is<uint32_t>()) {
        return payload[key];
    }
    return doc[key] | 0;
}

static void publishActionEventJson(const char* eventType, const char* source) {
    JsonDocument doc;
    char occurredAt[32];
    buildIsoTimestamp(occurredAt, sizeof(occurredAt));
    doc["deviceId"] = ConfigStore::net().deviceId;
    doc["eventType"] = eventType ? eventType : "";
    doc["occurredAt"] = occurredAt;
    doc["source"] = source ? source : "";

    char buf[192];
    size_t written = serializeJson(doc, buf, sizeof(buf));
    if (written > 0 && written < sizeof(buf)) {
        MqttClient::publishEvent(buf);
    }
}

// ---------------------------------------------------------------------------
// Command handler — dispatches MQTT commands
// ---------------------------------------------------------------------------
static void handleCommand(const char* payload, size_t len) {
    JsonDocument doc;
    if (deserializeJson(doc, payload, len) != DeserializationError::Ok) {
        EventLog::error("MQTT", "handleCommand: invalid JSON");
        return;
    }

    JsonVariantConst commandPayload = doc["payload"];
    const char* cmd        = doc["command"] | "";
    const char* deliveryId = doc["deliveryId"] | doc["command_id"] | "";

    char logMsg[128];
    snprintf(logMsg, sizeof(logMsg), "Command received: %s deliveryId=%s", cmd, deliveryId);
    EventLog::info("MQTT", logMsg);

    if (strcmp(cmd, "PRINT_NEXT_TOKEN") == 0) {
        PrintRequest req = {};
        req.mode = PrintMode::NORMAL_TOKEN;
        req.tokenNumber = TokenManager::peekNextNumber();
        if (TokenManager::requestNextToken() && PrinterDriver::enqueue(req)) {
            StatusLed::signalTrigger(StatusLedTriggerSource::REMOTE);
            MqttClient::publishActionEvent("print_next_token", "mqtt");
            MqttClient::publishAck(deliveryId, true, "queued");
        } else {
            MqttClient::publishAck(deliveryId, false, "printer_busy_or_error");
        }

    } else if (strcmp(cmd, "PRINT_CUSTOM_JSON") == 0) {
        PrintRequest req = {};
        req.mode = PrintMode::CUSTOM_JSON;
        if (!copyJsonVariant(commandPayload, req.customJson, sizeof(req.customJson))) {
            strlcpy(req.customJson, "{}", sizeof(req.customJson));
        }
        if (PrinterDriver::enqueue(req)) {
            StatusLed::signalTrigger(StatusLedTriggerSource::REMOTE);
            MqttClient::publishActionEvent("print_custom_json", "mqtt");
            MqttClient::publishAck(deliveryId, true, "queued");
        } else {
            MqttClient::publishAck(deliveryId, false, "queue_full");
        }

    } else if (strcmp(cmd, "TEST_PRINT") == 0) {
        PrintRequest req = {};
        req.mode = PrintMode::TEST_PRINT;
        if (PrinterDriver::enqueue(req)) {
            StatusLed::signalTrigger(StatusLedTriggerSource::REMOTE);
            MqttClient::publishActionEvent("test_print", "mqtt");
            MqttClient::publishAck(deliveryId, true, "queued");
        } else {
            MqttClient::publishAck(deliveryId, false, "queue_full");
        }

    } else if (strcmp(cmd, "RESET_ROLL_COUNTER") == 0) {
        PaperEstimator::resetRoll();
        MqttClient::publishActionEvent("reset_roll_counter", "mqtt");
        MqttClient::publishAck(deliveryId, true, "roll_counter_reset");

    } else if (strcmp(cmd, "SET_TOKEN_COUNTER") == 0) {
        uint32_t value = getPayloadUint(commandPayload, doc, "value");
        TokenManager::setCounter(value);
        MqttClient::publishActionEvent("set_token_counter", "mqtt");
        MqttClient::publishAck(deliveryId, true, "counter_set");

    } else if (strcmp(cmd, "SET_TOKEN_PREFIX") == 0) {
        const char* prefix = getPayloadString(commandPayload, doc, "prefix");
        if (strlen(prefix) == 0) {
            MqttClient::publishAck(deliveryId, false, "prefix_required");
        } else if (strlen(prefix) >= sizeof(ConfigStore::dev().tokenPrefix)) {
            MqttClient::publishAck(deliveryId, false, "prefix_too_long");
        } else {
            strlcpy(ConfigStore::dev().tokenPrefix,
                    prefix,
                    sizeof(ConfigStore::dev().tokenPrefix));
            ConfigStore::saveDev();
            MqttClient::publishActionEvent("set_token_prefix", "mqtt");
            MqttClient::publishAck(deliveryId, true, "prefix_set");
        }

    } else if (strcmp(cmd, "SET_TEMPLATE") == 0) {
        char tmplJson[1024];
        JsonVariantConst templatePayload = commandPayload;
        if (commandPayload.is<JsonObjectConst>() && !commandPayload["template"].isNull()) {
            templatePayload = commandPayload["template"];
        } else if (templatePayload.isNull()) {
            templatePayload = doc["template"];
        }
        bool payloadOk = copyJsonVariant(templatePayload, tmplJson, sizeof(tmplJson));
        bool ok = PrintTemplate::saveJson(tmplJson, strlen(tmplJson));
        if (!payloadOk) ok = false;
        MqttClient::publishAck(deliveryId, ok, ok ? "template_saved" : "template_invalid");

    } else if (strcmp(cmd, "REBOOT") == 0) {
        MqttClient::publishAck(deliveryId, true, "rebooting");
        vTaskDelay(pdMS_TO_TICKS(500));
        ESP.restart();

    } else if (strcmp(cmd, "OTA_UPDATE") == 0) {
        const char* url = getPayloadString(commandPayload, doc, "url");
        if (strlen(url) == 0) {
            MqttClient::publishAck(deliveryId, false, "url_required");
        } else {
            MqttClient::publishAck(deliveryId, true, "ota_starting");
            OtaService::startHttpOta(url);
        }

    } else if (strcmp(cmd, "FACTORY_RESET") == 0) {
        MqttClient::publishAck(deliveryId, true, "factory_resetting");
        vTaskDelay(pdMS_TO_TICKS(500));
        ConfigStore::factoryReset();
        ESP.restart();

    } else {
        MqttClient::publishAck(deliveryId, false, "unknown_command");
        EventLog::warn("MQTT", "Unknown command received");
    }
}

static void mqttCallback(char* topic, byte* payload, unsigned int length) {
    if (strcmp(topic, s_topicCommand) == 0) {
        handleCommand((const char*)payload, length);
    }
}

static bool reconnect() {
    const NetConfig& n = ConfigStore::net();
    if (strlen(n.mqttHost) == 0) return false;
    if (strlen(n.homeId) == 0) return false;
    if (strlen(n.deviceId) == 0) return false;

    buildTopics();
    s_mqtt.setServer(n.mqttHost, n.mqttPort);

    const char* willMsg = "{\"status\":\"offline\"}";

    bool connected = (strlen(n.mqttUser) > 0)
        ? s_mqtt.connect(n.mqttClientId, n.mqttUser, n.mqttPass,
                         s_topicLwt, 1, true, willMsg)
        : s_mqtt.connect(n.mqttClientId,
                         nullptr, nullptr,
                         s_topicLwt, 1, true, willMsg);

    if (connected) {
        s_mqtt.subscribe(s_topicCommand);
        EventLog::info("MQTT", "Connected to broker");

        // Publish online state
        MqttClient::publishState("{\"status\":\"online\"}");
    } else {
        char err[64];
        snprintf(err, sizeof(err), "MQTT connect failed: rc=%d", s_mqtt.state());
        EventLog::warn("MQTT", err);
    }
    return connected;
}

namespace MqttClient {

void begin() {
    buildTopics();
    s_mqtt.setCallback(mqttCallback);
    s_mqtt.setKeepAlive(60);
    s_mqtt.setSocketTimeout(5);
    s_mqtt.setBufferSize(2048);
}

void loop() {
    if (!s_mqtt.connected()) {
        static uint32_t lastAttempt = 0;
        uint32_t now = millis();
        if (now - lastAttempt > MQTT_RECONNECT_INTERVAL_MS) {
            lastAttempt = now;
            if (WiFi.status() == WL_CONNECTED) {
                reconnect();
            }
        }
    } else {
        s_mqtt.loop();
    }
}

bool isConnected() { return s_mqtt.connected(); }

void disconnect() {
    if (s_mqtt.connected()) s_mqtt.disconnect();
}

void publishState(const char* json) {
    if (!s_mqtt.connected()) return;
    s_mqtt.publish(s_topicStatus, json, true); // retained
}

void publishEvent(const char* json) {
    if (!s_mqtt.connected()) return;
    s_mqtt.publish(s_topicEvents, json, false);
}

void publishActionEvent(const char* eventType, const char* source) {
    if (!s_mqtt.connected()) return;
    publishActionEventJson(eventType, source);
}

void publishAck(const char* deliveryId, bool success, const char* reason) {
    if (!s_mqtt.connected()) return;

    JsonDocument doc;
    char acknowledgedAt[32];
    buildIsoTimestamp(acknowledgedAt, sizeof(acknowledgedAt));
    doc["deliveryId"] = deliveryId ? deliveryId : "";
    doc["deviceId"] = ConfigStore::net().deviceId;
    doc["acknowledgedAt"] = acknowledgedAt;
    doc["status"] = success ? "completed" : "failed";
    if (reason && reason[0] != '\0' && !success) {
        doc["errorMessage"] = reason;
    }

    char buf[256];
    size_t written = serializeJson(doc, buf, sizeof(buf));
    s_mqtt.publish(s_topicCommandAck, reinterpret_cast<const uint8_t*>(buf), written, false);
}

} // namespace MqttClient
