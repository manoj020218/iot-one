#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

#include "rf/RfLogic.h"
#include "system/Logger.h"

namespace rf {

class RfService {
 public:
  explicit RfService(systemlog::Logger& logger) : logger_(logger) {}

  void Begin(uint8_t pin, uint32_t debounceMs, uint32_t validHighMs,
             uint32_t duplicateMs, uint32_t learnWindowMs, uint32_t learnSettleMs);
  RfEvent Tick(uint32_t nowMs);
  bool StartLearning(uint32_t nowMs);
  void CancelLearning();
  bool LearningActive() const { return learningActive_; }
  bool LineHigh() const { return lineHigh_; }
  uint32_t LearningRemainingSec(uint32_t nowMs) const;
  void FillJson(JsonObject object, uint32_t nowMs) const;

 private:
  RfEvent TickLearning(uint32_t nowMs);
  void DriveLearningHigh();
  void ReleaseForMonitoring();
  void ApplyNormalMode();

  systemlog::Logger& logger_;
  RfLogic logic_{};
  uint8_t pin_ = 0;
  bool lineHigh_ = false;
  bool learningActive_ = false;
  bool drivingHigh_ = false;
  uint32_t learnValidHighMs_ = 40;
  uint32_t learnWindowMs_ = 10000;
  uint32_t learningExpiresAtMs_ = 0;
  uint32_t learnPulseEndsAtMs_ = 0;
  uint32_t passiveHighSinceMs_ = 0;
};

}  // namespace rf
