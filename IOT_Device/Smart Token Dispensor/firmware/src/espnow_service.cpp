#include "espnow_service.h"
#include "config_store.h"
#include "token_manager.h"
#include "printer_driver.h"
#include "paper_estimator.h"
#include "event_log.h"
#include "mqtt_client.h"
#include "status_led.h"
#include "version.h"
#include <esp_now.h>
#include <WiFi.h>

static bool s_initialized = false;

static const uint8_t BROADCAST_MAC[6] = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };

// Triggered when we receive a command from a paired peer
// Older ESP32 Arduino framework uses (mac, data, len) signature
#ifdef JENIX_PROV_V2
static void onDataReceive(const esp_now_recv_info_t* recvInfo, const uint8_t* data, int len)
#else
static void onDataReceive(const uint8_t* mac, const uint8_t* data, int len)
#endif
{
#ifdef JENIX_PROV_V2
    (void)recvInfo;
#else
    (void)mac;
#endif
    if (len != sizeof(EspNowCommand)) return;

    EspNowCommand cmd;
    memcpy(&cmd, data, sizeof(cmd));

    // Validate shared security key
    if (memcmp(cmd.securityKey, ConfigStore::dev().espNowKey, 8) != 0) {
        EventLog::warn("ESPNOW", "Received command with invalid key — ignored");
        return;
    }

    if (cmd.commandType == 0x01) { // TRIGGER_TOKEN
        PrintRequest req = {};
        req.mode        = PrintMode::NORMAL_TOKEN;
        req.tokenNumber = TokenManager::peekNextNumber();
        strlcpy(req.commandId, cmd.commandId, sizeof(req.commandId));
        if (TokenManager::requestNextToken() && PrinterDriver::enqueue(req)) {
            StatusLed::signalTrigger(StatusLedTriggerSource::REMOTE);
            MqttClient::publishActionEvent("print_next_token", "espnow");
        }
        EventLog::info("ESPNOW", "TRIGGER_TOKEN from peer");
    }
}

static void onDataSent(const uint8_t* mac, esp_now_send_status_t status) {
    // Broadcast send status — no action needed
    (void)mac; (void)status;
}

namespace EspNowService {

void begin() {
    // ESP-NOW requires WiFi to be initialized first
    // If WiFi is in AP+STA mode, ESP-NOW works alongside it
    if (esp_now_init() != ESP_OK) {
        EventLog::error("ESPNOW", "esp_now_init failed");
        return;
    }

    esp_now_register_recv_cb(onDataReceive);
    esp_now_register_send_cb(onDataSent);

    // Add broadcast peer
    esp_now_peer_info_t peerInfo = {};
    memcpy(peerInfo.peer_addr, BROADCAST_MAC, 6);
    peerInfo.channel  = 0;   // Current channel
    peerInfo.encrypt  = false;
    if (esp_now_add_peer(&peerInfo) != ESP_OK) {
        EventLog::warn("ESPNOW", "Failed to add broadcast peer");
    }

    s_initialized = true;
    EventLog::info("ESPNOW", "ESP-NOW initialized");
}

void broadcastStatus() {
    if (!s_initialized) return;

    EspNowStatus status = {};
    strlcpy(status.pid,      FIRMWARE_PID,                   sizeof(status.pid));
    strlcpy(status.deviceId, ConfigStore::net().deviceId,   sizeof(status.deviceId));
    status.currentToken        = TokenManager::currentNumber();
    status.lastPrintedToken    = TokenManager::lastPrintedNumber();
    status.printState          = (uint8_t)PrinterDriver::state();
    status.paperLow            = PaperEstimator::isPaperLow();
    status.estimatedTokensLeft = PaperEstimator::estimatedTokensLeft();
    status.printerError        = (PrinterDriver::state() == PrinterState::ERROR ||
                                  PrinterDriver::state() == PrinterState::PAPER_OUT);
    status.uptimeSec           = millis() / 1000;
    memcpy(status.securityKey, ConfigStore::dev().espNowKey, 8);

    esp_err_t err = esp_now_send(BROADCAST_MAC,
                                 (const uint8_t*)&status,
                                 sizeof(status));
    if (err != ESP_OK) {
        EventLog::warn("ESPNOW", "Broadcast send failed");
    }
}

bool isInitialized() { return s_initialized; }

} // namespace EspNowService
