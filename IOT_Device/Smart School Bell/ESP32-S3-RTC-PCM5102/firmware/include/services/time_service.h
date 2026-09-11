#pragma once

#include <ctime>
#include <string>

#include "app_types.h"
#include "drivers/rtc_driver.h"
#include "esp_err.h"

namespace app::services {

class TimeService {
 public:
  explicit TimeService(drivers::RtcDriver& rtc) : rtc_(rtc) {}

  esp_err_t init(const DeviceConfig& device_config);
  bool isTimeValid() const { return valid_; }
  esp_err_t getLocalTime(std::tm* out_tm) const;
  esp_err_t setRtcFromSystemClock() const;
  esp_err_t setLocalTime(const std::tm& local_time);
  esp_err_t applyTimezone(const DeviceConfig& device_config);

 private:
  static std::string resolvePosixTimezone(const DeviceConfig& config);

  drivers::RtcDriver& rtc_;
  bool valid_ = false;
  std::string timezone_posix_;
};

}  // namespace app::services
