#include "status_led/StatusLedService.h"

namespace statusled {

void StatusLedService::Begin(uint8_t pin, bool activeHigh) {
  pin_ = pin;
  activeHigh_ = activeHigh;
  pinMode(pin_, OUTPUT);
  Write(false);
}

void StatusLedService::RequestConfirmFlash(uint32_t nowMs) {
  confirmUntilMs_ = nowMs + 700;
}

void StatusLedService::Tick(uint32_t nowMs) {
  Write(PatternOn(nowMs));
}

void StatusLedService::FillJson(JsonObject object) const {
  object["state"] = app::ToString(state_);
  object["outputOn"] = currentOn_;
}

bool StatusLedService::PatternOn(uint32_t nowMs) const {
  if (nowMs < confirmUntilMs_) return (nowMs / 100U) % 2U == 0U;
  const uint32_t phase = nowMs % 1200U;
  switch (state_) {
    case app::AppState::Boot: return nowMs < 180U;
    case app::AppState::Normal: return phase < 60U;
    case app::AppState::Provisioning: return phase < 160U;
    case app::AppState::RfLearning: return phase < 100U || (phase >= 200U && phase < 300U);
    case app::AppState::Ota: return phase < 100U || (phase >= 180U && phase < 280U);
    case app::AppState::Error:
      return phase < 80U || (phase >= 160U && phase < 240U) ||
             (phase >= 320U && phase < 400U);
  }
  return false;
}

void StatusLedService::Write(bool on) {
  currentOn_ = on;
  digitalWrite(pin_, (activeHigh_ ? on : !on) ? HIGH : LOW);
}

}  // namespace statusled
