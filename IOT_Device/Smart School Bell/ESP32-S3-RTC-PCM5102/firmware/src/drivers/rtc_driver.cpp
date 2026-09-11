#include "drivers/rtc_driver.h"

#include <cstring>

#include "board_pins.h"
#include "esp_check.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

namespace app::drivers {

namespace {
constexpr uint8_t kDs3231Address = 0x68;
constexpr char kTag[] = "RtcDriver";
}

esp_err_t RtcDriver::init() {
  if (board::kRtcSda == GPIO_NUM_NC || board::kRtcScl == GPIO_NUM_NC) {
    ESP_LOGW(kTag, "RTC pins unresolved in board_pins.h");
    configured_ = false;
    return ESP_ERR_INVALID_STATE;
  }

  i2c_config_t config = {};
  config.mode = I2C_MODE_MASTER;
  config.sda_io_num = board::kRtcSda;
  config.scl_io_num = board::kRtcScl;
  config.sda_pullup_en = GPIO_PULLUP_ENABLE;
  config.scl_pullup_en = GPIO_PULLUP_ENABLE;
  config.master.clk_speed = board::kRtcI2cClockHz;

  ESP_RETURN_ON_ERROR(i2c_param_config(board::kRtcI2cPort, &config), kTag, "i2c config failed");
  const esp_err_t install_result = i2c_driver_install(board::kRtcI2cPort, config.mode, 0, 0, 0);
  if (install_result != ESP_OK && install_result != ESP_ERR_INVALID_STATE) {
    return install_result;
  }

  configured_ = true;
  return ESP_OK;
}

esp_err_t RtcDriver::readTm(std::tm* out_tm) const {
  if (!configured_ || out_tm == nullptr) {
    return ESP_ERR_INVALID_STATE;
  }

  uint8_t raw[7] = {};
  ESP_RETURN_ON_ERROR(readRegisters(0x00, raw, sizeof(raw)), kTag, "read time failed");

  std::tm time_value = {};
  time_value.tm_sec = fromBcd(raw[0] & 0x7F);
  time_value.tm_min = fromBcd(raw[1] & 0x7F);

  if (raw[2] & 0x40) {
    int hour = fromBcd(raw[2] & 0x1F);
    const bool pm = raw[2] & 0x20;
    time_value.tm_hour = (hour % 12) + (pm ? 12 : 0);
  } else {
    time_value.tm_hour = fromBcd(raw[2] & 0x3F);
  }

  time_value.tm_mday = fromBcd(raw[4] & 0x3F);
  time_value.tm_mon = fromBcd(raw[5] & 0x1F) - 1;
  time_value.tm_year = 100 + fromBcd(raw[6]);
  time_value.tm_isdst = -1;
  mktime(&time_value);

  *out_tm = time_value;
  return ESP_OK;
}

esp_err_t RtcDriver::writeTm(const std::tm& time_value) const {
  if (!configured_) {
    return ESP_ERR_INVALID_STATE;
  }

  const int year = time_value.tm_year + 1900;
  if (year < 2000 || year > 2099) {
    return ESP_ERR_INVALID_ARG;
  }

  uint8_t raw[7] = {};
  raw[0] = toBcd(static_cast<uint8_t>(time_value.tm_sec));
  raw[1] = toBcd(static_cast<uint8_t>(time_value.tm_min));
  raw[2] = toBcd(static_cast<uint8_t>(time_value.tm_hour));
  raw[3] = toBcd(static_cast<uint8_t>(time_value.tm_wday == 0 ? 7 : time_value.tm_wday));
  raw[4] = toBcd(static_cast<uint8_t>(time_value.tm_mday));
  raw[5] = toBcd(static_cast<uint8_t>(time_value.tm_mon + 1));
  raw[6] = toBcd(static_cast<uint8_t>(year - 2000));

  return writeRegisters(0x00, raw, sizeof(raw));
}

uint8_t RtcDriver::toBcd(uint8_t value) {
  return static_cast<uint8_t>(((value / 10) << 4) | (value % 10));
}

uint8_t RtcDriver::fromBcd(uint8_t value) {
  return static_cast<uint8_t>(((value >> 4) * 10) + (value & 0x0F));
}

esp_err_t RtcDriver::readRegisters(uint8_t start_register, uint8_t* buffer, size_t length) const {
  return i2c_master_write_read_device(
      board::kRtcI2cPort,
      kDs3231Address,
      &start_register,
      1,
      buffer,
      length,
      pdMS_TO_TICKS(1000));
}

esp_err_t RtcDriver::writeRegisters(uint8_t start_register, const uint8_t* buffer, size_t length) const {
  uint8_t payload[16] = {};
  if (length + 1 > sizeof(payload)) {
    return ESP_ERR_INVALID_SIZE;
  }

  payload[0] = start_register;
  std::memcpy(payload + 1, buffer, length);
  return i2c_master_write_to_device(
      board::kRtcI2cPort,
      kDs3231Address,
      payload,
      length + 1,
      pdMS_TO_TICKS(1000));
}

}  // namespace app::drivers
