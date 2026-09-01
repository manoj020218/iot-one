#pragma once
#include <Arduino.h>

// ---------------------------------------------------------------------------
// espnow_service — Local status broadcast and trusted command receive
//
// Broadcasts a compact status struct to 0xFF…FF (broadcast MAC).
// Receives TRIGGER_TOKEN commands from paired devices validated by
// a shared 8-byte key stored in DevConfig::espNowKey.
// ---------------------------------------------------------------------------

#pragma pack(push, 1)
struct EspNowStatus {
    char     pid[20];
    char     deviceId[20];
    uint32_t currentToken;
    uint32_t lastPrintedToken;
    uint8_t  printState;       // PrinterState cast to uint8
    bool     paperLow;
    uint32_t estimatedTokensLeft;
    bool     printerError;
    uint32_t uptimeSec;
    uint8_t  securityKey[8];   // Must match peer's key
};

struct EspNowCommand {
    uint8_t  securityKey[8];
    uint8_t  commandType;      // 0x01 = TRIGGER_TOKEN
    char     commandId[37];
};
#pragma pack(pop)

namespace EspNowService {
    void begin();
    void broadcastStatus();    // Call periodically from telemetry task
    bool isInitialized();
}
