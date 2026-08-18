#include "ota/OtaService.h"

#include <HTTPClient.h>
#include <Update.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

#include "app/ProductIdentity.h"
#include "ota/Semver.h"

namespace ota {

bool OtaService::RequestInstall(const String& url, const String& targetVersion,
                                bool allowDowngrade) {
  if (Active() || url.isEmpty()) return false;
  requestUrl_ = url;
  targetVersion_ = targetVersion;
  allowDowngrade_ = allowDowngrade;
  lastStatus_ = "queued";
  lastMessage_ = requestUrl_;
  pending_ = true;
  return true;
}

void OtaService::Tick() {
  if (pending_ && !running_) RunInstall();
  if (rebootPending_ && millis() >= rebootAtMs_) ESP.restart();
}

void OtaService::FillJson(JsonObject object) const {
  object["active"] = Active();
  object["status"] = lastStatus_;
  object["message"] = lastMessage_;
  object["url"] = requestUrl_;
}

void OtaService::RunInstall() {
  pending_ = false;
  running_ = true;
  lastStatus_ = "downloading";
  logger_.Info(String("Starting OTA from ") + requestUrl_);

  HTTPClient http;
  WiFiClient plainClient;
  WiFiClientSecure secureClient;
  const bool secure = requestUrl_.startsWith("https://");
  if (secure) secureClient.setInsecure();
  const bool began =
      secure ? http.begin(secureClient, requestUrl_) : http.begin(plainClient, requestUrl_);
  if (!began) {
    Fail("http_begin_failed");
    return;
  }

  const char* headers[] = {"x-fw-version", "x-firmware-version"};
  http.collectHeaders(headers, 2);
  const int code = http.GET();
  if (code != HTTP_CODE_OK) {
    http.end();
    Fail(String("http_") + code);
    return;
  }

  String nextVersion = targetVersion_;
  if (nextVersion.isEmpty()) nextVersion = http.header("x-fw-version");
  if (nextVersion.isEmpty()) nextVersion = http.header("x-firmware-version");
  if (!nextVersion.isEmpty() && !allowDowngrade_ &&
      CompareSemver(nextVersion, app::kFirmwareVersion) < 0) {
    http.end();
    Fail("downgrade_blocked");
    return;
  }

  const int contentLength = http.getSize();
  if (contentLength <= 0 || !Update.begin(static_cast<size_t>(contentLength))) {
    http.end();
    Fail("update_begin_failed");
    return;
  }

  WiFiClient* stream = http.getStreamPtr();
  size_t written = 0;
  uint8_t buffer[1024];
  while (http.connected() && written < static_cast<size_t>(contentLength)) {
    const size_t available = static_cast<size_t>(stream->available());
    if (available == 0) {
      delay(1);
      continue;
    }
    const size_t readCount = stream->readBytes(buffer, available > sizeof(buffer) ? sizeof(buffer)
                                                                                  : available);
    if (Update.write(buffer, readCount) != readCount) {
      Update.abort();
      http.end();
      Fail("update_write_failed");
      return;
    }
    written += readCount;
    delay(1);
  }

  const bool ok = Update.end() && Update.isFinished();
  http.end();
  if (!ok) {
    Fail("update_end_failed");
    return;
  }

  running_ = false;
  rebootPending_ = true;
  rebootAtMs_ = millis() + 1200;
  lastStatus_ = "installed";
  lastMessage_ = nextVersion.isEmpty() ? "restarting" : nextVersion;
  logger_.Info("OTA installed, scheduling reboot");
}

void OtaService::Fail(const String& message) {
  running_ = false;
  pending_ = false;
  rebootPending_ = false;
  lastStatus_ = "error";
  lastMessage_ = message;
  logger_.Error(String("OTA failed: ") + message);
}

}  // namespace ota
