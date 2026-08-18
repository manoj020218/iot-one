#include "button/ButtonService.h"

namespace button {

void ButtonService::Begin(uint8_t pin, bool activeLow) {
  pin_ = pin;
  activeLow_ = activeLow;
  enabled_ = true;
  pinMode(pin_, activeLow_ ? INPUT_PULLUP : INPUT);
}

ButtonEvent ButtonService::Tick(uint32_t nowMs) {
  if (!enabled_) return ButtonEvent::None;
  const bool high = digitalRead(pin_) == HIGH;
  const bool pressed = activeLow_ ? !high : high;
  return logic_.Update(nowMs, pressed);
}

}  // namespace button
