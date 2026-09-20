#pragma once

#include <atomic>
#include <cstdint>

#include "app_types.h"
#include "driver/gpio.h"
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

namespace app::drivers {

class ButtonDriver {
 public:
  esp_err_t init();
  ButtonEvent poll();
  bool isPressed() const { return pressed_.load(std::memory_order_relaxed); }
  static esp_err_t configureActiveLow(gpio_num_t pin);
  static bool activeLowPressed(gpio_num_t pin);

 private:
  static void pollTask(void* context);
  ButtonEvent sample();

  bool gpio_ready_ = false;
  std::atomic<ButtonEvent> pending_event_{ButtonEvent::None};
  std::atomic<bool> pressed_{false};
  TaskHandle_t task_handle_ = nullptr;
  bool factory_reset_reported_ = false;
  int64_t press_started_ms_ = 0;
  int64_t release_started_ms_ = 0;
};

}  // namespace app::drivers
