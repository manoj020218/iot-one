#pragma once

#include <cstdint>

namespace button {

enum class ButtonEvent : uint8_t {
  None = 0,
  ShortPress,
  RfLearnMultiPress,
  FactoryResetMultiPress,
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
        factoryHoldFired_ = false;
      } else if (!factoryHoldFired_) {
        if (clickCount_ < 255) ++clickCount_;
        lastReleaseAtMs_ = nowMs;
      }
    }

    if (stablePressed_) {
      const uint32_t heldMs = nowMs - pressedAtMs_;
      if (!factoryHoldFired_ && heldMs >= kFactoryResetHoldMs) {
        factoryHoldFired_ = true;
        clickCount_ = 0;
        lastReleaseAtMs_ = 0;
        return ButtonEvent::FactoryResetHold;
      }
      return ButtonEvent::None;
    }

    if (clickCount_ == 0 || nowMs - lastReleaseAtMs_ < kMultiPressWindowMs) {
      return ButtonEvent::None;
    }

    const uint8_t completedClicks = clickCount_;
    clickCount_ = 0;
    lastReleaseAtMs_ = 0;

    if (completedClicks >= 10) {
      return ButtonEvent::FactoryResetMultiPress;
    }
    if (completedClicks >= 5) {
      return ButtonEvent::RfLearnMultiPress;
    }
    if (completedClicks == 1) {
      return ButtonEvent::ShortPress;
    }
    return ButtonEvent::None;
  }

 private:
  static constexpr uint32_t kDebounceMs = 25;
  static constexpr uint32_t kMultiPressWindowMs = 700;
  static constexpr uint32_t kFactoryResetHoldMs = 30000;
  bool lastRawPressed_ = false;
  bool stablePressed_ = false;
  uint32_t lastDebounceAtMs_ = 0;
  uint32_t pressedAtMs_ = 0;
  uint32_t lastReleaseAtMs_ = 0;
  uint8_t clickCount_ = 0;
  bool factoryHoldFired_ = false;
};

}  // namespace button
