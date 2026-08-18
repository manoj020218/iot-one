#pragma once

#include <WebServer.h>

#include "platform/ControlApi.h"

namespace web {

class WebServerService {
 public:
  void Begin(platform::ControlApi& api);
  void Tick();

 private:
  bool ParseJsonBody(StaticJsonDocument<512>& doc);
  void SendOk();
  void SendError(const char* message);

  WebServer server_{80};
  platform::ControlApi* api_ = nullptr;
};

}  // namespace web
