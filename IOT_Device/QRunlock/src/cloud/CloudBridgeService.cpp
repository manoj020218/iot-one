#include "cloud/CloudBridgeService.h"

#include <cstring>

#include "app/ProductIdentity.h"
#include "config/Defaults.h"
#include "system/TimeUtil.h"

namespace cloud {

CloudBridgeService* CloudBridgeService::instance_ = nullptr;

void CloudBridgeService::MqttCallbackTrampoline(char* topic, uint8_t* payload,
                                                unsigned int length) {
  if (instance_ != nullptr) instance_->HandleMessage(topic, payload, length);
}

void CloudBridgeService::Begin(platform::ControlApi& api) {
  api_ = &api;
  instance_ = this;
  mqtt_.setCallback(MqttCallbackTrampoline);
  mqtt_.setBufferSize(512);
  mqtt_.setKeepAlive(60);
  mqtt_.setSocketTimeout(5);
  RebuildTopics();
}

void CloudBridgeService::ApplyConfig() {
  if (mqtt_.connected()) mqtt_.disconnect();
  connected_ = false;
  RebuildTopics();
  lastReconnectAttemptMs_ = 0;
}

void CloudBridgeService::Tick(uint32_t nowMs, bool wifiConnected) {
  if (!wifiConnected) {
    if (mqtt_.connected()) mqtt_.disconnect();
    connected_ = false;
    return;
  }
  if (!ntpStarted_) {
    systemtime::Begin();
    ntpStarted_ = true;
  }
  if (!store_.Cloud().configured) {
    connected_ = false;
    return;
  }
  if (mqtt_.connected()) {
    mqtt_.loop();
    connected_ = true;
    return;
  }
  connected_ = false;
  if (nowMs - lastReconnectAttemptMs_ < config::kMqttReconnectMs) return;
  lastReconnectAttemptMs_ = nowMs;
  Reconnect(nowMs);
}

void CloudBridgeService::RebuildTopics() {
  const config::CloudConfig& cfg = store_.Cloud();
  const char* tenantId = cfg.homeId[0] != '\0' ? cfg.homeId : "unbound";
  const char* deviceId = identity_.DeviceId().c_str();
  BuildTopic(cmdTopic_, sizeof(cmdTopic_), tenantId, app::kPid, deviceId, "cmd");
  BuildTopic(cmdAckTopic_, sizeof(cmdAckTopic_), tenantId, app::kPid, deviceId, "cmd/ack");
  BuildTopic(statusTopic_, sizeof(statusTopic_), tenantId, app::kPid, deviceId, "status");
  BuildTopic(lwtTopic_, sizeof(lwtTopic_), tenantId, app::kPid, deviceId, "lwt");
}

bool CloudBridgeService::Reconnect(uint32_t nowMs) {
  (void)nowMs;
  const config::CloudConfig& cfg = store_.Cloud();
  if (cfg.homeId[0] == '\0') return false;

  mqtt_.setServer(cfg.mqttHost, cfg.mqttPort);
  const char* clientId = identity_.DeviceId().c_str();
  const bool hasAuth = cfg.mqttUsername[0] != '\0';
  if (!hasAuth) {
    // The broker's acl_file only reliably grants PUBLISH to a named "user"
    // block (see BRIDGE.md §4) — an anonymous connect will still succeed
    // and still subscribe fine, making this failure mode invisible unless
    // it's logged explicitly. Every status/ack publish from here on will be
    // silently dropped by the broker.
    logger_.Warn("MQTT connecting anonymously — no mqttUsername configured; "
                 "publishes (status/cmd ack) will likely be silently denied");
  }
  const char* willMessage = "{\"status\":\"offline\"}";

  const bool ok = hasAuth
      ? mqtt_.connect(clientId, cfg.mqttUsername, cfg.mqttPassword, lwtTopic_, 1, true,
                      willMessage)
      : mqtt_.connect(clientId, nullptr, nullptr, lwtTopic_, 1, true, willMessage);

  if (!ok) {
    logger_.Warn(String("MQTT connect failed rc=") + mqtt_.state());
    return false;
  }

  mqtt_.subscribe(cmdTopic_, 1);
  connected_ = true;
  logger_.Info(String("MQTT connected, subscribed ") + cmdTopic_);
  PublishStatus("online", true);
  return true;
}

void CloudBridgeService::HandleMessage(char* topic, uint8_t* payload, unsigned int length) {
  if (std::strcmp(topic, cmdTopic_) != 0) return;

  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, payload, length) != DeserializationError::Ok) {
    logger_.Warn("MQTT command payload invalid JSON");
    return;
  }

  const char* deliveryId = doc["deliveryId"] | "";
  const char* command = doc["command"] | "";
  const CommandKind kind = ParseCommandKind(command);

  if (kind != CommandKind::Unlock) {
    logger_.Warn(String("MQTT unsupported command: ") + command);
    PublishAck(deliveryId, false, "unsupported_command");
    return;
  }

  const char* reason = doc["payload"]["reason"] | "mqtt";
  const bool ok = api_->Unlock(reason);
  PublishAck(deliveryId, ok, ok ? nullptr : "unlock_rejected");
}

void CloudBridgeService::PublishAck(const char* deliveryId, bool success,
                                    const char* errorMessage) {
  if (!mqtt_.connected()) return;

  StaticJsonDocument<256> doc;
  doc["deliveryId"] = deliveryId;
  doc["deviceId"] = identity_.DeviceId();
  char nowIso[24];
  systemtime::NowIso8601(nowIso, sizeof(nowIso));
  doc["acknowledgedAt"] = nowIso;
  doc["status"] = success ? "completed" : "failed";
  if (!success && errorMessage != nullptr) doc["errorMessage"] = errorMessage;

  char buf[256];
  const size_t written = serializeJson(doc, buf, sizeof(buf));
  mqtt_.publish(cmdAckTopic_, reinterpret_cast<const uint8_t*>(buf), written, false);
}

void CloudBridgeService::PublishStatus(const char* status, bool retained) {
  if (!mqtt_.connected()) return;
  char buf[64];
  std::snprintf(buf, sizeof(buf), "{\"status\":\"%s\"}", status);
  mqtt_.publish(statusTopic_, buf, retained);
}

void CloudBridgeService::FillJson(JsonObject object) const {
  const config::CloudConfig& cfg = store_.Cloud();
  object["configured"] = static_cast<bool>(cfg.configured);
  object["connected"] = connected_;
  object["homeId"] = cfg.homeId;
  object["mqttHost"] = cfg.mqttHost;
  object["mqttPort"] = cfg.mqttPort;
  object["mqttUsernameConfigured"] = cfg.mqttUsername[0] != '\0';
  object["cmdTopic"] = cmdTopic_;
}

}  // namespace cloud
