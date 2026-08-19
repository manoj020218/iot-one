#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

#include "relay/RelayLogic.h"
#include "system/Logger.h"

namespace relay {

class RelayService {
 public:
  explicit RelayService(systemlog::Logger& logger) : logger_(logger) {}

  void Begin(uint8_t pin, bool activeHigh, uint16_t pulseMs, uint16_t cooldownMs);
  void Configure(uint16_t pulseMs, uint16_t cooldownMs);
  void Tick(uint32_t nowMs);
  bool Pulse(uint32_t nowMs, const String& reason);
  bool Active() const { return logic_.Active(); }
  bool StateOn() const { return stateOn_; }
  uint16_t PulseMs() const { return logic_.PulseMs(); }
  uint16_t CooldownMs() const { return logic_.CooldownMs(); }
  void FillJson(JsonObject object) const;

 private:
  void WriteOutput(bool active);

  systemlog::Logger& logger_;
  RelayLogic logic_{};
  uint8_t pin_ = 0;
  bool activeHigh_ = true;
  bool outputHigh_ = false;
  bool stateOn_ = false;
  String lastReason_ = "boot";
};

}  // namespace relay
