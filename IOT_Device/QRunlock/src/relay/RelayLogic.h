#pragma once

#include <cstdint>

namespace relay {

class RelayLogic {
 public:
  void Configure(uint16_t pulseMs, uint16_t cooldownMs) {
    pulseMs_ = pulseMs;
    cooldownMs_ = cooldownMs;
  }

  bool RequestPulse(uint32_t nowMs) {
    if (active_ || nowMs - lastFinishedAtMs_ < cooldownMs_) return false;
    active_ = true;
    pulseEndsAtMs_ = nowMs + pulseMs_;
    return true;
  }

  bool Update(uint32_t nowMs) {
    if (!active_ || nowMs < pulseEndsAtMs_) return false;
    active_ = false;
    lastFinishedAtMs_ = nowMs;
    return true;
  }

  bool Active() const { return active_; }
  uint16_t PulseMs() const { return pulseMs_; }
  uint16_t CooldownMs() const { return cooldownMs_; }

 private:
  uint16_t pulseMs_ = 1000;
  uint16_t cooldownMs_ = 1500;
  uint32_t pulseEndsAtMs_ = 0;
  uint32_t lastFinishedAtMs_ = 0;
  bool active_ = false;
};

}  // namespace relay
