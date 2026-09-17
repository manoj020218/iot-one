#pragma once
#include <Arduino.h>

// ---------------------------------------------------------------------------
// mqtt_client — MQTT telemetry + command handler
//
// Topics follow the Jenix One platform convention:
//   jnx/{homeId}/{pid}/{deviceId}/status (periodic snapshot; .../telemetry is
//     reserved platform-side for internal scene-job relay, not device data)
//   jnx/{homeId}/{pid}/{deviceId}/cmd
//   jnx/{homeId}/{pid}/{deviceId}/cmd/ack
//   jnx/{homeId}/{pid}/{deviceId}/events
//   jnx/{homeId}/{pid}/{deviceId}/lwt
//
// Runs inside taskNetwork; loop() called from that task.
// Command callbacks fire on the MQTT receive callback (network task context).
// ---------------------------------------------------------------------------

namespace MqttClient {
    void begin();

    // Called from network task loop — maintains connection and calls client.loop().
    void loop();

    bool isConnected();

    // Publish helpers
    void publishState(const char* json);
    void publishEvent(const char* json);
    void publishActionEvent(const char* eventType, const char* source);

    // Publish a command acknowledgement.
    void publishAck(const char* deliveryId, bool success, const char* reason = "");

    // Force disconnect (e.g. before OTA).
    void disconnect();
}
