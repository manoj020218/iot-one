#include "rf/RfService.h"

namespace rf {
namespace {

constexpr uint32_t kLearnDriveSliceMs = 18;
constexpr uint32_t kLearnSampleSliceMs = 2;

}

void RfService::Begin(uint8_t pin, uint32_t debounceMs, uint32_t validHighMs,
                      uint32_t duplicateMs, uint32_t learnWindowMs,
                      uint32_t learnSettleMs) {
  pin_ = pin;
  logic_.Configure(debounceMs, validHighMs, duplicateMs, learnWindowMs, learnSettleMs);
  learnValidHighMs_ = validHighMs;
  learnWindowMs_ = learnWindowMs;
  ApplyNormalMode();
}

RfEvent RfService::Tick(uint32_t nowMs) {
  if (learningActive_) return TickLearning(nowMs);
  lineHigh_ = digitalRead(pin_) == HIGH;
  const RfEvent event = logic_.Update(nowMs, lineHigh_);
  if (event.type == RfEventType::Triggered) {
    logger_.Info(String("RF VT trigger detected on GPIO") + pin_);
  }
  return event;
}

bool RfService::StartLearning(uint32_t nowMs) {
  if (learningActive_) return false;
  learningActive_ = true;
  learningExpiresAtMs_ = nowMs + learnWindowMs_;
  phaseStartedAtMs_ = nowMs;
  passiveHighSinceMs_ = 0;
  DriveLearningHigh();
  logger_.Warn(String("GPIO") + pin_ +
               " one-wire RF learn started: driving HIGH for 10s with sample releases");
  return true;
}

void RfService::CancelLearning() {
  learningActive_ = false;
  passiveHighSinceMs_ = 0;
  ApplyNormalMode();
  logger_.Info("RF learning cancelled");
}

uint32_t RfService::LearningRemainingSec(uint32_t nowMs) const {
  if (!learningActive_ || nowMs >= learningExpiresAtMs_) return 0;
  return ((learningExpiresAtMs_ - nowMs) + 999U) / 1000U;
}

void RfService::FillJson(JsonObject object, uint32_t nowMs) const {
  object["gpio"] = pin_;
  object["lineHigh"] = lineHigh_;
  object["learningActive"] = learningActive_;
  object["learningSecondsRemaining"] = LearningRemainingSec(nowMs);
  object["monitorMode"] = learningActive_ ? (drivingHigh_ ? "OUTPUT_HIGH" : "INPUT_SAMPLE")
                                          : "INPUT";
  object["electricalMode"] = learningActive_ ? "one_wire_resistor_drive" : "input_only";
  object["hardwareNote"] =
      "Shared GPIO6/VT learn mode assumes 3.3V-only module and 1k series resistor.";
}

RfEvent RfService::TickLearning(uint32_t nowMs) {
  if (nowMs >= learningExpiresAtMs_) {
    learningActive_ = false;
    passiveHighSinceMs_ = 0;
    ApplyNormalMode();
    logger_.Info(String("RF learning timeout on GPIO") + pin_);
    return {RfEventType::LearningTimeout};
  }

  if (drivingHigh_) {
    lineHigh_ = true;
    if (nowMs - phaseStartedAtMs_ >= kLearnDriveSliceMs) {
      ReleaseForSampling();
      phaseStartedAtMs_ = nowMs;
    }
    return {};
  }

  lineHigh_ = digitalRead(pin_) == HIGH;
  if (lineHigh_) {
    if (passiveHighSinceMs_ == 0) passiveHighSinceMs_ = nowMs;
    if (nowMs - passiveHighSinceMs_ >= learnValidHighMs_) {
      learningActive_ = false;
      passiveHighSinceMs_ = 0;
      ApplyNormalMode();
      logger_.Info(String("RF learning success: receiver held GPIO") + pin_ +
                   " HIGH during sample release");
      return {RfEventType::LearningSuccess};
    }
  } else {
    passiveHighSinceMs_ = 0;
  }

  if (nowMs - phaseStartedAtMs_ >= kLearnSampleSliceMs) {
    DriveLearningHigh();
    phaseStartedAtMs_ = nowMs;
  }
  return {};
}

void RfService::DriveLearningHigh() {
  pinMode(pin_, OUTPUT);
  digitalWrite(pin_, HIGH);
  drivingHigh_ = true;
}

void RfService::ReleaseForSampling() {
  pinMode(pin_, INPUT);
  drivingHigh_ = false;
}

void RfService::ApplyNormalMode() {
  pinMode(pin_, INPUT);
}

}  // namespace rf
