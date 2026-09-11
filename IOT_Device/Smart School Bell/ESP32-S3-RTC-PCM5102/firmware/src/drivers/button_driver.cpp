#include "drivers/button_driver.h"

#include "app_config.h"
#include "board_pins.h"
#include "driver/gpio.h"
#include "esp_check.h"
#include "esp_timer.h"

namespace app::drivers {

esp_err_t ButtonDriver::init() {
  if (board::kServiceButton == GPIO_NUM_NC) {
    gpio_ready_ = false;
    return ESP_OK;
  }

  ESP_RETURN_ON_ERROR(configureActiveLow(board::kServiceButton), "ButtonDriver", "button config failed");
  gpio_ready_ = true;
  return ESP_OK;
}

esp_err_t ButtonDriver::configureActiveLow(gpio_num_t pin) {
  if (pin == GPIO_NUM_NC) return ESP_ERR_INVALID_ARG;
  gpio_config_t config = {};
  config.pin_bit_mask = (1ULL << pin);
  config.mode = GPIO_MODE_INPUT;
  config.pull_up_en = GPIO_PULLUP_ENABLE;
  config.pull_down_en = GPIO_PULLDOWN_DISABLE;
  config.intr_type = GPIO_INTR_DISABLE;

  return gpio_config(&config);
}

bool ButtonDriver::activeLowPressed(gpio_num_t pin) {
  return pin != GPIO_NUM_NC && gpio_get_level(pin) == 0;
}

ButtonEvent ButtonDriver::poll() {
  if (!gpio_ready_) {
    return ButtonEvent::None;
  }

  const bool raw_pressed = activeLowPressed(board::kServiceButton);
  const int64_t now_ms = esp_timer_get_time() / 1000;

  if (raw_pressed && !pressed_) {
    pressed_ = true;
    press_started_ms_ = now_ms;
    return ButtonEvent::None;
  }

  if (raw_pressed) {
    return ButtonEvent::None;
  }

  if (!raw_pressed && pressed_) {
    pressed_ = false;
    const int64_t held_ms = now_ms - press_started_ms_;
    if (held_ms >= static_cast<int64_t>(app::config::kFactoryResetMinMs)) {
      return ButtonEvent::FactoryReset;
    }
    if (held_ms >= static_cast<int64_t>(app::config::kLongPressMinMs)) {
      return ButtonEvent::LongPress;
    }
    if (held_ms >= static_cast<int64_t>(app::config::kShortPressMinMs)) {
      return ButtonEvent::ShortPress;
    }
  }

  return ButtonEvent::None;
}

}  // namespace app::drivers
