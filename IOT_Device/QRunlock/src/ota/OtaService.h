#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

#include "system/Logger.h"

namespace ota {

class OtaService {
 public:
  explicit OtaService(systemlog::Logger& logger) : logger_(logger) {}

  bool RequestInstall(const String& url, const String& targetVersion, bool allowDowngrade);
  void Tick();
  bool Active() const { return pending_ || running_ || rebootPending_; }
  bool HasError() const { return lastStatus_ == "error"; }
  void FillJson(JsonObject object) const;

 private:
  void RunInstall();
  void Fail(const String& message);

  systemlog::Logger& logger_;
  String requestUrl_;
  String targetVersion_;
  String lastStatus_ = "idle";
  String lastMessage_;
  bool allowDowngrade_ = false;
  bool pending_ = false;
  bool running_ = false;
  bool rebootPending_ = false;
  uint32_t rebootAtMs_ = 0;
};

}  // namespace ota
