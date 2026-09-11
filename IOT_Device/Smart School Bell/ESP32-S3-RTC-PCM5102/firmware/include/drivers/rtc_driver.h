#pragma once

#include <ctime>

#include "driver/i2c.h"
#include "esp_err.h"

namespace app::drivers {

class RtcDriver {
 public:
  esp_err_t init();
  esp_err_t readTm(std::tm* out_tm) const;
  esp_err_t writeTm(const std::tm& time_value) const;
  bool isConfigured() const { return configured_; }

 private:
  static uint8_t toBcd(uint8_t value);
  static uint8_t fromBcd(uint8_t value);
  esp_err_t readRegisters(uint8_t start_register, uint8_t* buffer, size_t length) const;
  esp_err_t writeRegisters(uint8_t start_register, const uint8_t* buffer, size_t length) const;

  bool configured_ = false;
};

}  // namespace app::drivers
