#pragma once

#include <cstdint>

namespace app {

enum class AppState : uint8_t {
  Boot = 0,
  Normal,
  Provisioning,
  RfLearning,
  Ota,
  Error,
};

struct StateInputs {
  uint32_t uptimeMs;
  bool apActive;
  bool learningActive;
  bool otaActive;
  bool errorLatched;
};

inline AppState ResolveState(const StateInputs& inputs) {
  if (inputs.errorLatched) return AppState::Error;
  if (inputs.otaActive) return AppState::Ota;
  if (inputs.learningActive) return AppState::RfLearning;
  if (inputs.apActive) return AppState::Provisioning;
  if (inputs.uptimeMs < 1500) return AppState::Boot;
  return AppState::Normal;
}

inline const char* ToString(AppState state) {
  switch (state) {
    case AppState::Boot: return "BOOT";
    case AppState::Normal: return "NORMAL";
    case AppState::Provisioning: return "PROVISIONING";
    case AppState::RfLearning: return "RF_LEARNING";
    case AppState::Ota: return "OTA";
    case AppState::Error: return "ERROR";
  }
  return "UNKNOWN";
}

}  // namespace app
