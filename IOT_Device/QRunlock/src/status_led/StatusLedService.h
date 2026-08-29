#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

#include "app/AppState.h"

namespace statusled {

class StatusLedService {
 public:
  void Begin(uint8_t pin, bool activeHigh);
  void SetState(app::AppState state) { state_ = state; }
  void RequestRelayTriggerFlash(uint32_t nowMs);
  void RequestRfLearnQuietHold(uint32_t nowMs);
  void ClearRfLearnQuietHold();
  void Tick(uint32_t nowMs);
 void FillJson(JsonObject object) const;

 private:
  bool PatternOn(uint32_t nowMs) const;
  uint32_t ElapsedSinceFlashStart(uint32_t nowMs) const;
  void Write(bool on);

  uint8_t pin_ = 0;
  bool activeHigh_ = true;
  bool currentOn_ = false;
  bool relayFlashActive_ = false;
  uint32_t relayFlashStartedAtMs_ = 0;
  uint32_t rfLearnQuietUntilMs_ = 0;
  app::AppState state_ = app::AppState::Boot;
};

}  // namespace statusled
