#include "web/WebServerService.h"

#include <ArduinoJson.h>

#include "web/WebPageHtml.h"

namespace web {

void WebServerService::Begin(platform::ControlApi& api) {
  api_ = &api;
  server_.on("/", HTTP_GET, [this]() { server_.send(200, "text/html", kIndexHtml); });
  server_.on("/api/status", HTTP_GET, [this]() {
    DynamicJsonDocument doc(4096);
    api_->FillStatus(doc);
    String payload;
    serializeJson(doc, payload);
    SendPayload(200, "application/json", payload);
  });
  server_.on("/provision", HTTP_OPTIONS, [this]() {
    ApplyCorsHeaders();
    server_.send(204);
  });
  server_.on("/provision", HTTP_POST, [this]() {
    StaticJsonDocument<512> request;
    if (!ParseJsonBody(request, true)) return;
    DynamicJsonDocument response(1024);
    api_->HandleProvisioningRequest(request, response);
    String payload;
    serializeJson(response, payload);
    SendPayload(200, "application/json", payload, true);
  });
  server_.on("/api/relay/pulse", HTTP_POST, [this]() {
    api_->Unlock("web");
    SendOk();
  });
  server_.on("/api/rf/learn/start", HTTP_POST, [this]() {
    api_->StartRfLearning() ? SendOk() : SendError("learn_start_failed");
  });
  server_.on("/api/rf/learn/cancel", HTTP_POST, [this]() {
    api_->CancelRfLearning();
    SendOk();
  });
  server_.on("/api/provisioning", HTTP_POST, [this]() {
    api_->EnterProvisioning();
    SendOk();
  });
  server_.on("/api/restart", HTTP_POST, [this]() {
    api_->Restart();
    SendOk();
  });
  server_.on("/api/factory-reset", HTTP_POST, [this]() {
    api_->FactoryReset();
    SendOk();
  });
  server_.on("/api/wifi", HTTP_POST, [this]() {
    StaticJsonDocument<512> doc;
    if (!ParseJsonBody(doc)) return;
    api_->ApplyWifi(doc["ssid"] | "", doc["password"] | "") ? SendOk()
                                                             : SendError("wifi_save_failed");
  });
  server_.on("/api/settings", HTTP_POST, [this]() {
    StaticJsonDocument<512> doc;
    if (!ParseJsonBody(doc)) return;
    api_->SaveSettings(doc["relayPulseMs"] | 0, doc["relayCooldownMs"] | 0,
                       doc["otaUrl"] | "")
        ? SendOk()
        : SendError("settings_save_failed");
  });
  server_.on("/api/ota/install", HTTP_POST, [this]() {
    StaticJsonDocument<512> doc;
    if (!ParseJsonBody(doc)) return;
    api_->RequestOta(doc["url"] | "", doc["targetVersion"] | "",
                     doc["allowDowngrade"] | false)
        ? SendOk()
        : SendError("ota_request_failed");
  });
  server_.begin();
}

void WebServerService::Tick() { server_.handleClient(); }

void WebServerService::ApplyCorsHeaders() {
  server_.sendHeader("Access-Control-Allow-Origin", "*");
  server_.sendHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  server_.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

bool WebServerService::ParseJsonBody(StaticJsonDocument<512>& doc, bool cors) {
  const String body = server_.arg("plain");
  if (deserializeJson(doc, body)) {
    SendError("invalid_json", cors);
    return false;
  }
  return true;
}

void WebServerService::SendPayload(int statusCode, const char* contentType,
                                   const String& payload, bool cors) {
  if (cors) ApplyCorsHeaders();
  server_.send(statusCode, contentType, payload);
}

void WebServerService::SendOk(bool cors) {
  SendPayload(200, "application/json", "{\"ok\":true}", cors);
}

void WebServerService::SendError(const char* message, bool cors) {
  const String payload = String("{\"ok\":false,\"error\":\"") + message + "\"}";
  SendPayload(400, "application/json", payload, cors);
}

}  // namespace web
