#include "drivers/led_driver.h"

#include <array>

#include "board_pins.h"
#include "esp_check.h"
#include "esp_timer.h"

namespace app::drivers {

namespace {
constexpr uint32_t kRmtResolutionHz = 10'000'000;
constexpr uint16_t kWs2812T0hTicks = 4;   // 0.4 us
constexpr uint16_t kWs2812T0lTicks = 9;   // 0.9 us
constexpr uint16_t kWs2812T1hTicks = 8;   // 0.8 us
constexpr uint16_t kWs2812T1lTicks = 5;   // 0.5 us
constexpr uint16_t kWs2812ResetTicks = 600;  // 60 us per half-symbol
constexpr uint8_t kStatusBrightness = 24;

rmt_symbol_word_t bitSymbol(bool one) {
  rmt_symbol_word_t symbol = {};
  symbol.level0 = 1;
  symbol.duration0 = one ? kWs2812T1hTicks : kWs2812T0hTicks;
  symbol.level1 = 0;
  symbol.duration1 = one ? kWs2812T1lTicks : kWs2812T0lTicks;
  return symbol;
}
}  // namespace

esp_err_t LedDriver::init() {
  if (board::kStatusLed == GPIO_NUM_NC) {
    gpio_ready_ = false;
    return ESP_OK;
  }

  rmt_tx_channel_config_t channel_config = {};
  channel_config.gpio_num = board::kStatusLed;
  channel_config.clk_src = RMT_CLK_SRC_DEFAULT;
  channel_config.resolution_hz = kRmtResolutionHz;
  channel_config.mem_block_symbols = 64;
  channel_config.trans_queue_depth = 1;

  esp_err_t err = rmt_new_tx_channel(&channel_config, &channel_);
  if (err != ESP_OK) return err;

  rmt_copy_encoder_config_t encoder_config = {};
  err = rmt_new_copy_encoder(&encoder_config, &encoder_);
  if (err != ESP_OK) {
    rmt_del_channel(channel_);
    channel_ = nullptr;
    return err;
  }

  err = rmt_enable(channel_);
  if (err != ESP_OK) {
    rmt_del_encoder(encoder_);
    rmt_del_channel(channel_);
    encoder_ = nullptr;
    channel_ = nullptr;
    return err;
  }

  gpio_ready_ = true;
  ESP_RETURN_ON_ERROR(writePixel(0, 0, 0), "LedDriver", "initial LED write failed");
  if (xTaskCreate(&LedDriver::updateTask, "status_led", 2048, this, 2, &task_handle_) != pdPASS) {
    task_handle_ = nullptr;
    return ESP_ERR_NO_MEM;
  }
  return ESP_OK;
}

void LedDriver::setPattern(LedPattern pattern) {
  requested_pattern_.store(pattern, std::memory_order_relaxed);
}

void LedDriver::updateTask(void* context) {
  auto* driver = static_cast<LedDriver*>(context);
  while (true) {
    driver->tick();
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

void LedDriver::tick() {
  if (!gpio_ready_) return;

  const int64_t now_ms = esp_timer_get_time() / 1000;
  const LedPattern requested = requested_pattern_.load(std::memory_order_relaxed);
  if (pattern_ != requested) {
    pattern_ = requested;
    last_toggle_ms_ = now_ms;
    last_red_ = 0xFF;
    last_green_ = 0xFF;
    last_blue_ = 0xFF;
    setPhysicalState(pattern_ != LedPattern::Off);
    return;
  }

  switch (pattern_) {
    case LedPattern::Off:
      setPhysicalState(false);
      break;
    case LedPattern::SolidReady:
      setPhysicalState(true);
      break;
    case LedPattern::BlinkProvisioning:
      if ((now_ms - last_toggle_ms_) >= 100) {
        setPhysicalState(!current_state_);
        last_toggle_ms_ = now_ms;
      }
      break;
    case LedPattern::BlinkFactoryResetHold:
      if ((now_ms - last_toggle_ms_) >= 250) {
        setPhysicalState(!current_state_);
        last_toggle_ms_ = now_ms;
      }
      break;
    case LedPattern::BlinkFactoryResetComplete:
      if ((now_ms - last_toggle_ms_) >= 100) {
        setPhysicalState(!current_state_);
        last_toggle_ms_ = now_ms;
      }
      break;
    case LedPattern::AlternateProvisioningIncomplete:
      if ((now_ms - last_toggle_ms_) >= 250) {
        setPhysicalState(!current_state_);
        last_toggle_ms_ = now_ms;
      }
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
  uint8_t red = 0;
  uint8_t green = 0;
  uint8_t blue = 0;

  if (pattern_ == LedPattern::AlternateProvisioningIncomplete) {
    if (on) {
      blue = kStatusBrightness;
    } else {
      red = kStatusBrightness;
    }
  } else if (on) {
    switch (pattern_) {
      case LedPattern::HeartbeatBoot:
        blue = kStatusBrightness;
        break;
      case LedPattern::BlinkSync:
        green = kStatusBrightness;
        blue = kStatusBrightness;
        break;
      case LedPattern::BlinkProvisioning:
        blue = kStatusBrightness;
        break;
      case LedPattern::BlinkFactoryResetHold:
        red = kStatusBrightness;
        green = kStatusBrightness / 3;
        break;
      case LedPattern::BlinkFactoryResetComplete:
        blue = kStatusBrightness;
        break;
      case LedPattern::AlternateProvisioningIncomplete:
        break;
      case LedPattern::BlinkRtcInvalid:
        red = kStatusBrightness;
        green = kStatusBrightness / 3;
        break;
      case LedPattern::BlinkFatal:
        red = kStatusBrightness;
        break;
      case LedPattern::SolidReady:
      default:
        green = kStatusBrightness;
        break;
    }
  }

  if (writePixel(red, green, blue) == ESP_OK) current_state_ = on;
}

esp_err_t LedDriver::writePixel(uint8_t red, uint8_t green, uint8_t blue) {
  if (!gpio_ready_ || channel_ == nullptr || encoder_ == nullptr) {
    return ESP_ERR_INVALID_STATE;
  }
  if (red == last_red_ && green == last_green_ && blue == last_blue_) return ESP_OK;

  // WS2812 wire order is GRB, most-significant bit first.
  const uint32_t grb = (static_cast<uint32_t>(green) << 16) |
                       (static_cast<uint32_t>(red) << 8) |
                       static_cast<uint32_t>(blue);
  std::array<rmt_symbol_word_t, 25> symbols = {};
  for (size_t bit = 0; bit < 24; ++bit) {
    symbols[bit] = bitSymbol((grb & (1UL << (23 - bit))) != 0);
  }
  symbols[24].level0 = 0;
  symbols[24].duration0 = kWs2812ResetTicks;
  symbols[24].level1 = 0;
  symbols[24].duration1 = kWs2812ResetTicks;

  rmt_transmit_config_t transmit_config = {};
  esp_err_t err =
      rmt_transmit(channel_, encoder_, symbols.data(), sizeof(symbols), &transmit_config);
  if (err == ESP_OK) err = rmt_tx_wait_all_done(channel_, 10);
  if (err == ESP_OK) {
    last_red_ = red;
    last_green_ = green;
    last_blue_ = blue;
  }
  return err;
}

}  // namespace app::drivers
