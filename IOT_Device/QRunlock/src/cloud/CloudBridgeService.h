#pragma once

#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <WiFi.h>

#include "cloud/CloudBridgeLogic.h"
#include "device_identity/DeviceIdentity.h"
#include "platform/ControlApi.h"
#include "storage/ConfigStore.h"
#include "system/Logger.h"

namespace cloud {

// Connects this device to the Jenix One platform MQTT broker and bridges
// remote commands into the same platform::ControlApi every other input
// (button, RF, local web UI) already goes through — see BRIDGE.md for the
// full protocol and the reuse pattern for future devices.
//
// Reconnects on its own (Tick()), following the exact convention every
// other Jenix device firmware in this repo already uses (Token Dispenser's
// src/mqtt_client.cpp, Tank Guard's src/mqtt_client.cpp): a plain
// WiFiClient + PubSubClient, a Last-Will-and-Testament "offline" status
// message, a fixed reconnect interval instead of a blocking retry loop.
class CloudBridgeService {
 public:
  CloudBridgeService(storage::ConfigStore& store, identity::DeviceIdentity& identity,
                     systemlog::Logger& logger)
      : store_(store), identity_(identity), logger_(logger) {}

  void Begin(platform::ControlApi& api);

  // wifiConnected must reflect the *current* Wi-Fi link state every call —
  // this service never touches Wi-Fi itself (WifiManager owns that).
  void Tick(uint32_t nowMs, bool wifiConnected);

  // Call after ConfigStore::SaveCloud() persists a new homeId/broker —
  // rebuilds topic strings and forces a fresh connect on the next Tick().
  void ApplyConfig();

  bool Connected() const { return connected_; }
  void FillJson(JsonObject object) const;

  // Called by AppController::HandleRfEvent() when RfService resolves a
  // learn attempt (RfEventType::LearningSuccess/LearningTimeout) — the
  // platform has no other way to know a pairing actually succeeded, since
  // that only happens later, asynchronously, whenever the user's physical
  // remote gets pressed (see rf-learning.service.ts's own doc comment on
  // the VPS side for the previous best-effort-timeout-only state of this).
  // Publishes to the canonical .../events topic, same suffix every other
  // event-driven device (e.g. nurse-call-receiver) already uses. No-op if
  // not connected — same best-effort posture as PublishStatus/PublishAck.
  void PublishRfLearnResult(const char* result);

 private:
  void RebuildTopics();
  bool Reconnect(uint32_t nowMs);
  void HandleMessage(char* topic, uint8_t* payload, unsigned int length);
  void ScheduleAck(const char* deliveryId, bool success, const char* errorMessage);
  void FlushPendingAck(uint32_t nowMs);
  void PublishAck(const char* deliveryId, bool success, const char* errorMessage);
  void PublishStatus(const char* status, bool retained);

  storage::ConfigStore& store_;
  identity::DeviceIdentity& identity_;
  systemlog::Logger& logger_;
  platform::ControlApi* api_ = nullptr;

  WiFiClient wifiClient_;
  PubSubClient mqtt_{wifiClient_};

  char cmdTopic_[160]{};
  char cmdAckTopic_[160]{};
  char statusTopic_[160]{};
  char eventsTopic_[160]{};
  char lwtTopic_[160]{};

  uint32_t lastReconnectAttemptMs_ = 0;
  bool connected_ = false;
  bool ntpStarted_ = false;

  // A command ack is deliberately NOT published synchronously from inside
  // HandleMessage() — PubSubClient::publish() is a blocking network write
  // (worst case up to mqtt_.setSocketTimeout()'s 5s), and doing it
  // immediately after api_->Unlock() starves AppController::Tick() of the
  // many fast iterations StatusLedService needs to actually paint the
  // two-flash relay-trigger indicator in real wall-clock time before its
  // ~340ms window closes (see StatusLedService::kRelayFlashTotalMs) — the
  // relay still fires correctly either way, but the LED silently never
  // flashes. Deferring the publish past that window (see kAckDeferMs in
  // the .cpp) lets the cheap, non-blocking Tick() calls in between render
  // the flash before the one blocking network call of this command runs.
  bool pendingAckActive_ = false;
  uint32_t pendingAckRequestedAtMs_ = 0;
  char pendingAckDeliveryId_[64]{};
  bool pendingAckSuccess_ = false;
  bool pendingAckHasError_ = false;
  char pendingAckError_[32]{};

  // PubSubClient's callback is a plain C function pointer, so it can't bind
  // to a member function. Exactly one CloudBridgeService ever exists (an
  // AppController member, itself the single `gApp` in main.cpp), so a
  // static back-pointer + free-function trampoline is safe and is the
  // standard pattern for this library — see MqttCallbackTrampoline in the
  // .cpp.
  static CloudBridgeService* instance_;
  static void MqttCallbackTrampoline(char* topic, uint8_t* payload, unsigned int length);
};

}  // namespace cloud
