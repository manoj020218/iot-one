#include "web/WebServerService.h"

#include <ArduinoJson.h>

#include "config/Defaults.h"
#include "web/WebPageHtml.h"

namespace web {

void WebServerService::Begin(platform::ControlApi& api) {
  api_ = &api;
  const char* headerKeys[] = {config::kLocalApiAuthHeaderName};
  server_.collectHeaders(headerKeys, 1);
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
    if (!EnsureAuthorized(true)) return;
    StaticJsonDocument<512> request;
    if (!ParseJsonBody(request, true)) return;
    DynamicJsonDocument response(1024);
    api_->HandleProvisioningRequest(request, response);
    String payload;
    serializeJson(response, payload);
    SendPayload(200, "application/json", payload, true);
  });
  server_.on("/api/relay/pulse", HTTP_POST, [this]() {
    if (!EnsureAuthorized()) return;
    api_->Unlock("web");
    SendOk();
  });
  server_.on("/api/rf/learn/start", HTTP_POST, [this]() {
    if (!EnsureAuthorized()) return;
    api_->StartRfLearning() ? SendOk() : SendError("learn_start_failed");
  });
  server_.on("/api/rf/learn/cancel", HTTP_POST, [this]() {
    if (!EnsureAuthorized()) return;
    api_->CancelRfLearning();
    SendOk();
  });
  server_.on("/api/provisioning", HTTP_POST, [this]() {
    if (!EnsureAuthorized()) return;
    api_->EnterProvisioning();
    SendOk();
  });
  server_.on("/api/restart", HTTP_POST, [this]() {
    if (!EnsureAuthorized()) return;
    api_->Restart();
    SendOk();
  });
  server_.on("/api/factory-reset", HTTP_POST, [this]() {
    if (!EnsureAuthorized()) return;
    api_->FactoryReset();
    SendOk();
  });
  server_.on("/api/wifi", HTTP_POST, [this]() {
    if (!EnsureAuthorized()) return;
    StaticJsonDocument<512> doc;
    if (!ParseJsonBody(doc)) return;
    api_->ApplyWifi(doc["ssid"] | "", doc["password"] | "") ? SendOk()
                                                             : SendError("wifi_save_failed");
  });
  server_.on("/api/cloud", HTTP_POST, [this]() {
    if (!EnsureAuthorized()) return;
    StaticJsonDocument<512> doc;
    if (!ParseJsonBody(doc)) return;
    const bool homeIdProvided = doc.containsKey("homeId");
    const bool mqttHostProvided = doc.containsKey("mqttHost");
    const bool mqttPortProvided = doc.containsKey("mqttPort");
    const bool mqttUsernameProvided = doc.containsKey("mqttUsername");
    const bool mqttPasswordProvided = doc.containsKey("mqttPassword");
    api_->SaveCloudConfig(doc["homeId"] | "", homeIdProvided,
                          doc["mqttHost"] | "", mqttHostProvided,
                          doc["mqttPort"] | 0, mqttPortProvided,
                          doc["mqttUsername"] | "",
                          mqttUsernameProvided, doc["mqttPassword"] | "",
                          mqttPasswordProvided)
        ? SendOk()
        : SendError("cloud_save_failed");
  });
  server_.on("/api/settings", HTTP_POST, [this]() {
    if (!EnsureAuthorized()) return;
    StaticJsonDocument<512> doc;
    if (!ParseJsonBody(doc)) return;
    api_->SaveSettings(doc["relayPulseMs"] | 0, doc["relayCooldownMs"] | 0,
                       doc["otaUrl"] | "")
        ? SendOk()
        : SendError("settings_save_failed");
  });
  server_.on("/api/ota/install", HTTP_POST, [this]() {
    if (!EnsureAuthorized()) return;
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
  server_.sendHeader("Access-Control-Allow-Headers",
                     String("Content-Type, ") + config::kLocalApiAuthHeaderName);
}

bool WebServerService::EnsureAuthorized(bool cors) {
  if (!server_.hasHeader(config::kLocalApiAuthHeaderName)) {
    SendPayload(401, "application/json", "{\"ok\":false,\"error\":\"auth_required\"}",
                cors);
    return false;
  }
  if (!api_->AuthorizeLocalMutation(server_.header(config::kLocalApiAuthHeaderName))) {
    SendPayload(403, "application/json", "{\"ok\":false,\"error\":\"auth_invalid\"}",
                cors);
    return false;
  }
  return true;
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
