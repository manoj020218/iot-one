#pragma once
#include <Arduino.h>

// ---------------------------------------------------------------------------
// ota_service — OTA firmware update
//
// Supports two update paths:
//   1. ArduinoOTA (local network, IDE / PlatformIO OTA target)
//   2. HTTP OTA   (binary URL pushed via MQTT OTA_UPDATE command)
//
// Always validates partition integrity before switching boot partition.
// Publishes progress events via EventLog and MQTT.
// ---------------------------------------------------------------------------

namespace OtaService {
    void begin();

    // Call from network task to handle ArduinoOTA events.
    void loop();

    // Start HTTP OTA from url. Blocks until complete or error.
    // Progress reported via EventLog + MQTT event.
    bool startHttpOta(const char* url);

    bool isUpdating();
}
