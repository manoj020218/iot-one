#pragma once

#include <cstdint>

#include "app_types.h"
#include "esp_err.h"

namespace app::drivers {

class LedDriver {
 public:
  esp_err_t init();
  void setPattern(LedPattern pattern);
  void tick();

 private:
  void setPhysicalState(bool on);

  LedPattern pattern_ = LedPattern::Off;
  bool gpio_ready_ = false;
  bool current_state_ = false;
  int64_t last_toggle_ms_ = 0;
};

}  // namespace app::drivers
