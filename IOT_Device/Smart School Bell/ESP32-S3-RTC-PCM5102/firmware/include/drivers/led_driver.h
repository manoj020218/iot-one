#pragma once

#include <atomic>
#include <cstdint>

#include "app_types.h"
#include "driver/rmt_encoder.h"
#include "driver/rmt_tx.h"
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

namespace app::drivers {

class LedDriver {
 public:
  esp_err_t init();
  void setPattern(LedPattern pattern);
  void tick();

 private:
  static void updateTask(void* context);
  void setPhysicalState(bool on);
  esp_err_t writePixel(uint8_t red, uint8_t green, uint8_t blue);

  std::atomic<LedPattern> requested_pattern_{LedPattern::Off};
  LedPattern pattern_ = LedPattern::Off;
  rmt_channel_handle_t channel_ = nullptr;
  rmt_encoder_handle_t encoder_ = nullptr;
  TaskHandle_t task_handle_ = nullptr;
  bool gpio_ready_ = false;
  bool current_state_ = false;
  uint8_t last_red_ = 0xFF;
  uint8_t last_green_ = 0xFF;
  uint8_t last_blue_ = 0xFF;
  int64_t last_toggle_ms_ = 0;
};

}  // namespace app::drivers
