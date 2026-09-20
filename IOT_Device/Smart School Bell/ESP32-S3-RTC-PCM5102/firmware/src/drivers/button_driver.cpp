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

  const BaseType_t task_created = xTaskCreate(
      pollTask, "service_button", 2048, this, 3, &task_handle_);
  if (task_created != pdPASS) {
    gpio_ready_ = false;
    task_handle_ = nullptr;
    return ESP_ERR_NO_MEM;
  }
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
  return pending_event_.exchange(ButtonEvent::None, std::memory_order_acq_rel);
}

void ButtonDriver::pollTask(void* context) {
  auto* driver = static_cast<ButtonDriver*>(context);
  while (true) {
    const ButtonEvent event = driver->sample();
    if (event != ButtonEvent::None) {
      ButtonEvent expected = ButtonEvent::None;
      driver->pending_event_.compare_exchange_strong(
          expected, event, std::memory_order_release, std::memory_order_relaxed);
    }
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

ButtonEvent ButtonDriver::sample() {
  if (!gpio_ready_) {
    return ButtonEvent::None;
  }

  const bool raw_pressed = activeLowPressed(board::kServiceButton);
  const bool was_pressed = pressed_.load(std::memory_order_relaxed);
  const int64_t now_ms = esp_timer_get_time() / 1000;

  if (raw_pressed && !was_pressed) {
    pressed_.store(true, std::memory_order_relaxed);
    factory_reset_reported_ = false;
    press_started_ms_ = now_ms;
    release_started_ms_ = 0;
    return ButtonEvent::None;
  }

  if (raw_pressed) {
    // A momentary open contact must not split one deliberate hold into
    // multiple short/long presses.
    release_started_ms_ = 0;
    const int64_t held_ms = now_ms - press_started_ms_;
    if (!factory_reset_reported_ &&
        held_ms >= static_cast<int64_t>(app::config::kFactoryResetMinMs)) {
      factory_reset_reported_ = true;
      return ButtonEvent::FactoryReset;
    }
    return ButtonEvent::None;
  }

  if (!raw_pressed && was_pressed) {
    if (release_started_ms_ == 0) {
      release_started_ms_ = now_ms;
      return ButtonEvent::None;
    }
    if ((now_ms - release_started_ms_) <
        static_cast<int64_t>(app::config::kButtonReleaseGraceMs)) {
      return ButtonEvent::None;
    }

    pressed_.store(false, std::memory_order_relaxed);
    const int64_t held_ms = release_started_ms_ - press_started_ms_;
    release_started_ms_ = 0;
    if (factory_reset_reported_) {
      factory_reset_reported_ = false;
      return ButtonEvent::None;
    }
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
