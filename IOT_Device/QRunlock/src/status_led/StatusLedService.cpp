#include "status_led/StatusLedService.h"

namespace statusled {
namespace {

constexpr uint32_t kRfLearnQuietMs = 10000;
constexpr uint32_t kRelayFlashLeadOffMs = 50;
constexpr uint32_t kRelayFlashOnMs = 80;
constexpr uint32_t kRelayFlashGapMs = 80;
constexpr uint32_t kRelayFlashTailOffMs = 50;
constexpr uint32_t kRelayFlashTotalMs =
    kRelayFlashLeadOffMs + kRelayFlashOnMs + kRelayFlashGapMs + kRelayFlashOnMs +
    kRelayFlashTailOffMs;

}

void StatusLedService::Begin(uint8_t pin, bool activeHigh) {
  pin_ = pin;
  activeHigh_ = activeHigh;
  pinMode(pin_, OUTPUT);
  Write(false);
}

void StatusLedService::RequestRelayTriggerFlash(uint32_t nowMs) {
  relayFlashStartedAtMs_ = nowMs;
  relayFlashActive_ = true;
}

void StatusLedService::RequestRfLearnQuietHold(uint32_t nowMs) {
  rfLearnQuietUntilMs_ = nowMs + kRfLearnQuietMs;
}

void StatusLedService::ClearRfLearnQuietHold() {
  rfLearnQuietUntilMs_ = 0;
}

void StatusLedService::Tick(uint32_t nowMs) {
  if (relayFlashActive_ && nowMs - relayFlashStartedAtMs_ >= kRelayFlashTotalMs) {
    relayFlashActive_ = false;
  }
  Write(PatternOn(nowMs));
}

void StatusLedService::FillJson(JsonObject object) const {
  object["state"] = app::ToString(state_);
  object["outputOn"] = currentOn_;
  object["relayTriggerFlashActive"] = relayFlashActive_;
  object["rfLearnQuietHoldActive"] = rfLearnQuietUntilMs_ != 0;
}

bool StatusLedService::PatternOn(uint32_t nowMs) const {
  if (relayFlashActive_) {
    const uint32_t elapsedMs = nowMs - relayFlashStartedAtMs_;
    const bool firstFlashOn =
        elapsedMs >= kRelayFlashLeadOffMs &&
        elapsedMs < (kRelayFlashLeadOffMs + kRelayFlashOnMs);
    const bool secondFlashOn =
        elapsedMs >= (kRelayFlashLeadOffMs + kRelayFlashOnMs + kRelayFlashGapMs) &&
        elapsedMs < (kRelayFlashLeadOffMs + kRelayFlashOnMs + kRelayFlashGapMs +
                     kRelayFlashOnMs);
    return firstFlashOn || secondFlashOn;
  }

  if (state_ == app::AppState::Error) {
    const uint32_t phase = nowMs % 1200U;
    return phase < 80U || (phase >= 160U && phase < 240U) ||
           (phase >= 320U && phase < 400U);
  }

  if (state_ == app::AppState::Ota) {
    const uint32_t phase = nowMs % 600U;
    return phase < 100U || (phase >= 200U && phase < 300U);
  }

  if (state_ == app::AppState::RfLearning) {
    const uint32_t phase = nowMs % 300U;
    return phase < 150U;
  }

  if (rfLearnQuietUntilMs_ != 0 && nowMs < rfLearnQuietUntilMs_) {
    return false;
  }

  switch (state_) {
    case app::AppState::Boot: {
      const uint32_t phase = nowMs % 1000U;
      return phase < 120U || (phase >= 240U && phase < 360U);
    }
    case app::AppState::Normal: {
      const uint32_t phase = nowMs % 4000U;
      return phase < 50U;
    }
    case app::AppState::ProvisioningAp: {
      const uint32_t phase = nowMs % 2000U;
      return phase < 250U;
    }
    case app::AppState::ProvisioningBle: {
      const uint32_t phase = nowMs % 240U;
      return phase < 120U;
    }
    case app::AppState::WifiConnected: {
      const uint32_t phase = nowMs % 5000U;
      return phase < 3000U;
    }
    case app::AppState::CloudConnected:
      return true;
    case app::AppState::RfLearning:
    case app::AppState::Ota:
    case app::AppState::Error:
      break;
  }
  return false;
}

void StatusLedService::Write(bool on) {
  currentOn_ = on;
  digitalWrite(pin_, (activeHigh_ ? on : !on) ? HIGH : LOW);
}

}  // namespace statusled
