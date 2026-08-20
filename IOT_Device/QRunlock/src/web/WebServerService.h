#pragma once

#include <WebServer.h>

#include "platform/ControlApi.h"

namespace web {

class WebServerService {
 public:
  void Begin(platform::ControlApi& api);
  void Tick();

 private:
  void ApplyCorsHeaders();
  bool ParseJsonBody(StaticJsonDocument<512>& doc, bool cors = false);
  void SendPayload(int statusCode, const char* contentType, const String& payload,
                   bool cors = false);
  void SendOk(bool cors = false);
  void SendError(const char* message, bool cors = false);

  WebServer server_{80};
  platform::ControlApi* api_ = nullptr;
};

}  // namespace web
