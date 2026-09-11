#include "drivers/led_driver.h"

#include "board_pins.h"
#include "driver/gpio.h"
#include "esp_check.h"
#include "esp_timer.h"

namespace app::drivers {

namespace {
uint64_t pinMask(gpio_num_t pin) {
  return 1ULL << static_cast<uint32_t>(pin);
}
}

esp_err_t LedDriver::init() {
  const gpio_num_t led_pin = board::kStatusLed;
  if (led_pin == GPIO_NUM_NC) {
    gpio_ready_ = false;
    return ESP_OK;
  }

  gpio_config_t config = {};
  config.pin_bit_mask = pinMask(led_pin);
  config.mode = GPIO_MODE_OUTPUT;
  config.pull_up_en = GPIO_PULLUP_DISABLE;
  config.pull_down_en = GPIO_PULLDOWN_DISABLE;
  config.intr_type = GPIO_INTR_DISABLE;

  ESP_RETURN_ON_ERROR(gpio_config(&config), "LedDriver", "gpio config failed");
  gpio_ready_ = true;
  setPhysicalState(false);
  return ESP_OK;
}

void LedDriver::setPattern(LedPattern pattern) {
  if (pattern_ != pattern) {
    pattern_ = pattern;
    last_toggle_ms_ = esp_timer_get_time() / 1000;
  }
}

void LedDriver::tick() {
  if (!gpio_ready_) {
    return;
  }

  const int64_t now_ms = esp_timer_get_time() / 1000;
  switch (pattern_) {
    case LedPattern::Off:
      setPhysicalState(false);
      break;
    case LedPattern::SolidReady:
      setPhysicalState(true);
      break;
    case LedPattern::HeartbeatBoot:
      if ((now_ms - last_toggle_ms_) >= 400) {
        setPhysicalState(!current_state_);
        last_toggle_ms_ = now_ms;
      }
      break;
    case LedPattern::BlinkSync:
      if ((now_ms - last_toggle_ms_) >= 250) {
        setPhysicalState(!current_state_);
        last_toggle_ms_ = now_ms;
      }
      break;
    case LedPattern::BlinkRtcInvalid:
      if ((now_ms - last_toggle_ms_) >= 700) {
        setPhysicalState(!current_state_);
        last_toggle_ms_ = now_ms;
      }
      break;
    case LedPattern::BlinkFatal:
      if ((now_ms - last_toggle_ms_) >= 120) {
        setPhysicalState(!current_state_);
        last_toggle_ms_ = now_ms;
      }
      break;
  }
}

void LedDriver::setPhysicalState(bool on) {
  current_state_ = on;
  if (gpio_ready_) {
    gpio_set_level(board::kStatusLed, on ? 1 : 0);
  }
}

}  // namespace app::drivers
