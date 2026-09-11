#pragma once

#include <cstdint>

#include "app_types.h"
#include "driver/gpio.h"
#include "esp_err.h"

namespace app::drivers {

class ButtonDriver {
 public:
  esp_err_t init();
  ButtonEvent poll();
  static esp_err_t configureActiveLow(gpio_num_t pin);
  static bool activeLowPressed(gpio_num_t pin);

 private:
  bool gpio_ready_ = false;
  bool pressed_ = false;
  int64_t press_started_ms_ = 0;
};

}  // namespace app::drivers
