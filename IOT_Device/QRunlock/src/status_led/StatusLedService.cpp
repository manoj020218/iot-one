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
  if (relayFlashActive_ && ElapsedSinceFlashStart(nowMs) >= kRelayFlashTotalMs) {
    relayFlashActive_ = false;
  }
  Write(PatternOn(nowMs));
}

uint32_t StatusLedService::ElapsedSinceFlashStart(uint32_t nowMs) const {
  // AppController::Tick() captures its own `nowMs` once at the top of the
  // loop and only reaches this call after cloud_.Tick() (MQTT) may have
  // already run — and AppController::Unlock() stamps
  // relayFlashStartedAtMs_ with its own fresh millis() read from *inside*
  // that MQTT handling. Parsing the incoming command is not free, so by
  // the time control returns here, that fresh timestamp can already be
  // later than the nowMs this Tick() call was given, making a plain
  // `nowMs - relayFlashStartedAtMs_` underflow to ~2^32 and instantly
  // read as "window long expired" — cancelling the flash before it ever
  // renders a single frame. This never showed up on the local HTTP
  // unlock path only because web_.Tick() runs after led_.Tick() in that
  // same loop, so the same-iteration ordering hazard never applied there.
  // Treat "hasn't happened yet from this Tick's point of view" as 0
  // elapsed rather than wrapping — the next Tick() call's fresher nowMs
  // resolves it correctly.
  if (nowMs < relayFlashStartedAtMs_) return 0;
  return nowMs - relayFlashStartedAtMs_;
}

void StatusLedService::FillJson(JsonObject object) const {
  object["state"] = app::ToString(state_);
  object["outputOn"] = currentOn_;
  object["relayTriggerFlashActive"] = relayFlashActive_;
  object["rfLearnQuietHoldActive"] = rfLearnQuietUntilMs_ != 0;
}

bool StatusLedService::PatternOn(uint32_t nowMs) const {
  if (relayFlashActive_) {
    const uint32_t elapsedMs = ElapsedSinceFlashStart(nowMs);
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
