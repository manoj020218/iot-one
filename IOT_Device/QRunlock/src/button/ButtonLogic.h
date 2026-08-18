#pragma once

#include <cstdint>

namespace button {

enum class ButtonEvent : uint8_t {
  None = 0,
  ShortPress,
  ProvisioningHold,
  FactoryResetHold,
};

class ButtonLogic {
 public:
  ButtonEvent Update(uint32_t nowMs, bool rawPressed) {
    if (rawPressed != lastRawPressed_) {
      lastRawPressed_ = rawPressed;
      lastDebounceAtMs_ = nowMs;
    }
    if (nowMs - lastDebounceAtMs_ < kDebounceMs) return ButtonEvent::None;
    if (rawPressed != stablePressed_) {
      stablePressed_ = rawPressed;
      if (stablePressed_) {
        pressedAtMs_ = nowMs;
        provisioningFired_ = false;
        factoryFired_ = false;
      } else if (!provisioningFired_ && !factoryFired_) {
        return ButtonEvent::ShortPress;
      }
    }
    if (!stablePressed_) return ButtonEvent::None;
    const uint32_t heldMs = nowMs - pressedAtMs_;
    if (!factoryFired_ && heldMs >= 10000) {
      factoryFired_ = true;
      provisioningFired_ = true;
      return ButtonEvent::FactoryResetHold;
    }
    if (!provisioningFired_ && heldMs >= 5000) {
      provisioningFired_ = true;
      return ButtonEvent::ProvisioningHold;
    }
    return ButtonEvent::None;
  }

 private:
  static constexpr uint32_t kDebounceMs = 25;
  bool lastRawPressed_ = false;
  bool stablePressed_ = false;
  uint32_t lastDebounceAtMs_ = 0;
  uint32_t pressedAtMs_ = 0;
  bool provisioningFired_ = false;
  bool factoryFired_ = false;
};

}  // namespace button
