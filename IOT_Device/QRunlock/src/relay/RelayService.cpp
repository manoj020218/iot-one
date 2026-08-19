#include "relay/RelayService.h"

namespace relay {

void RelayService::Begin(uint8_t pin, bool activeHigh, uint16_t pulseMs, uint16_t cooldownMs) {
  pin_ = pin;
  activeHigh_ = activeHigh;
  logic_.Configure(pulseMs, cooldownMs);
  pinMode(pin_, OUTPUT);
  WriteOutput(false);
}

void RelayService::Configure(uint16_t pulseMs, uint16_t cooldownMs) {
  logic_.Configure(pulseMs, cooldownMs);
}

void RelayService::Tick(uint32_t nowMs) {
  if (logic_.Update(nowMs)) {
    WriteOutput(false);
    logger_.Info("Relay pulse finished");
  }
}

bool RelayService::Pulse(uint32_t nowMs, const String& reason) {
  if (!logic_.RequestPulse(nowMs)) return false;
  stateOn_ = !stateOn_;
  lastReason_ = reason;
  WriteOutput(true);
  logger_.Info(String("Relay pulse started: ") + reason +
               (stateOn_ ? " -> state ON" : " -> state OFF"));
  return true;
}

void RelayService::FillJson(JsonObject object) const {
  object["active"] = logic_.Active();
  object["stateOn"] = stateOn_;
  object["pulseMs"] = logic_.PulseMs();
  object["cooldownMs"] = logic_.CooldownMs();
  object["lastReason"] = lastReason_;
}

void RelayService::WriteOutput(bool active) {
  outputHigh_ = activeHigh_ ? active : !active;
  digitalWrite(pin_, outputHigh_ ? HIGH : LOW);
}

}  // namespace relay
