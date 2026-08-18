#pragma once

#include <cstdint>

namespace rf {

enum class RfEventType : uint8_t {
  None = 0,
  Triggered,
  LearningSuccess,
  LearningTimeout,
};

struct RfEvent {
  RfEventType type = RfEventType::None;
};

class RfLogic {
 public:
  void Configure(uint32_t debounceMs, uint32_t validHighMs, uint32_t duplicateMs,
                 uint32_t learnWindowMs, uint32_t learnSettleMs) {
    debounceMs_ = debounceMs;
    validHighMs_ = validHighMs;
    duplicateMs_ = duplicateMs;
    learnWindowMs_ = learnWindowMs;
    learnSettleMs_ = learnSettleMs;
  }

  void StartLearning(uint32_t nowMs) {
    learningActive_ = true;
    learningStartedAtMs_ = nowMs;
    learningExpiresAtMs_ = nowMs + learnWindowMs_;
    learningBaselineKnown_ = false;
    triggerLatched_ = false;
  }

  void CancelLearning() { learningActive_ = false; }
  bool LearningActive() const { return learningActive_; }

  uint32_t LearningRemainingMs(uint32_t nowMs) const {
    if (!learningActive_ || nowMs >= learningExpiresAtMs_) return 0;
    return learningExpiresAtMs_ - nowMs;
  }

  bool StableHigh() const { return stableHigh_; }

  RfEvent Update(uint32_t nowMs, bool lineHigh) {
    if (lineHigh != rawHigh_) {
      rawHigh_ = lineHigh;
      lastEdgeAtMs_ = nowMs;
    }
    if (nowMs - lastEdgeAtMs_ >= debounceMs_ && stableHigh_ != rawHigh_) {
      stableHigh_ = rawHigh_;
      stableChangedAtMs_ = nowMs;
      if (!stableHigh_) triggerLatched_ = false;
    }

    if (learningActive_) {
      if (!learningBaselineKnown_ && nowMs - learningStartedAtMs_ >= learnSettleMs_) {
        learningBaselineKnown_ = true;
        learningBaselineHigh_ = stableHigh_;
      }
      if (learningBaselineKnown_ && stableHigh_ != learningBaselineHigh_ &&
          nowMs - stableChangedAtMs_ >= validHighMs_) {
        learningActive_ = false;
        return {RfEventType::LearningSuccess};
      }
      if (nowMs >= learningExpiresAtMs_) {
        learningActive_ = false;
        return {RfEventType::LearningTimeout};
      }
      return {};
    }

    if (stableHigh_ && !triggerLatched_ && nowMs - stableChangedAtMs_ >= validHighMs_ &&
        nowMs - lastTriggerAtMs_ >= duplicateMs_) {
      triggerLatched_ = true;
      lastTriggerAtMs_ = nowMs;
      return {RfEventType::Triggered};
    }
    return {};
  }

 private:
  uint32_t debounceMs_ = 20;
  uint32_t validHighMs_ = 40;
  uint32_t duplicateMs_ = 250;
  uint32_t learnWindowMs_ = 10000;
  uint32_t learnSettleMs_ = 250;
  uint32_t lastEdgeAtMs_ = 0;
  uint32_t stableChangedAtMs_ = 0;
  uint32_t lastTriggerAtMs_ = 0;
  uint32_t learningStartedAtMs_ = 0;
  uint32_t learningExpiresAtMs_ = 0;
  bool rawHigh_ = false;
  bool stableHigh_ = false;
  bool triggerLatched_ = false;
  bool learningActive_ = false;
  bool learningBaselineKnown_ = false;
  bool learningBaselineHigh_ = false;
};

}  // namespace rf
