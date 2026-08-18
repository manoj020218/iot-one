#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

#include "app/AppState.h"

namespace statusled {

class StatusLedService {
 public:
  void Begin(uint8_t pin, bool activeHigh);
  void SetState(app::AppState state) { state_ = state; }
  void RequestConfirmFlash(uint32_t nowMs);
  void Tick(uint32_t nowMs);
  void FillJson(JsonObject object) const;

 private:
  bool PatternOn(uint32_t nowMs) const;
  void Write(bool on);

  uint8_t pin_ = 0;
  bool activeHigh_ = true;
  bool currentOn_ = false;
  uint32_t confirmUntilMs_ = 0;
  app::AppState state_ = app::AppState::Boot;
};

}  // namespace statusled
