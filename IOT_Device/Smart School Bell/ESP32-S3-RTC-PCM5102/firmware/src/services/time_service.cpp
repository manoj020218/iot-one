#include "services/time_service.h"

#include <cstdlib>
#include <sys/time.h>
#include <time.h>

#include "app_config.h"
#include "esp_check.h"

namespace app::services {

esp_err_t TimeService::init(const DeviceConfig& device_config) {
  timezone_posix_ = resolvePosixTimezone(device_config);
  setenv("TZ", timezone_posix_.c_str(), 1);
  tzset();

  ESP_RETURN_ON_ERROR(rtc_.init(), "TimeService", "RTC init failed");

  std::tm rtc_time = {};
  ESP_RETURN_ON_ERROR(rtc_.readTm(&rtc_time), "TimeService", "RTC read failed");

  const int year = rtc_time.tm_year + 1900;
  if (year < static_cast<int>(app::config::kRtcMinValidYear) || year > static_cast<int>(app::config::kRtcMaxValidYear)) {
    valid_ = false;
    return ESP_ERR_INVALID_RESPONSE;
  }

  const time_t epoch = mktime(&rtc_time);
  if (epoch < 0) {
    valid_ = false;
    return ESP_FAIL;
  }

  timeval now = {};
  now.tv_sec = epoch;
  now.tv_usec = 0;
  settimeofday(&now, nullptr);
  valid_ = true;
  return ESP_OK;
}

esp_err_t TimeService::getLocalTime(std::tm* out_tm) const {
  if (!valid_ || out_tm == nullptr) return ESP_ERR_INVALID_STATE;

  const time_t epoch = time(nullptr);
  if (epoch <= 0) return ESP_FAIL;

  localtime_r(&epoch, out_tm);
  return ESP_OK;
}

esp_err_t TimeService::setRtcFromSystemClock() const {
  if (!valid_) return ESP_ERR_INVALID_STATE;

  const time_t epoch = time(nullptr);
  if (epoch <= 0) return ESP_FAIL;

  std::tm now{};
  localtime_r(&epoch, &now);
  return rtc_.writeTm(now);
}

esp_err_t TimeService::setLocalTime(const std::tm& local_time) {
  std::tm normalized = local_time;
  normalized.tm_isdst = -1;
  const time_t epoch = mktime(&normalized);
  if (epoch < 0) return ESP_ERR_INVALID_ARG;
  if (normalized.tm_year != local_time.tm_year || normalized.tm_mon != local_time.tm_mon ||
      normalized.tm_mday != local_time.tm_mday || normalized.tm_hour != local_time.tm_hour ||
      normalized.tm_min != local_time.tm_min || normalized.tm_sec != local_time.tm_sec) {
    return ESP_ERR_INVALID_ARG;
  }

  ESP_RETURN_ON_ERROR(rtc_.writeTm(normalized), "TimeService", "RTC write failed");
  timeval now = {};
  now.tv_sec = epoch;
  now.tv_usec = 0;
  settimeofday(&now, nullptr);
  valid_ = true;
  return ESP_OK;
}

esp_err_t TimeService::applyTimezone(const DeviceConfig& device_config) {
  const std::string next_timezone = resolvePosixTimezone(device_config);
  if (next_timezone.empty() || next_timezone.size() > 127) return ESP_ERR_INVALID_ARG;
  for (const unsigned char ch : next_timezone) {
    if (ch < 0x20 || ch > 0x7e) return ESP_ERR_INVALID_ARG;
  }

  const std::string previous_timezone = timezone_posix_;
  if (setenv("TZ", next_timezone.c_str(), 1) != 0) return ESP_FAIL;
  tzset();
  timezone_posix_ = next_timezone;

  // The system clock stores an absolute instant. Re-write the RTC using the
  // new local representation so the selected timezone survives a reboot.
  if (valid_) {
    const time_t epoch = time(nullptr);
    std::tm local{};
    localtime_r(&epoch, &local);
    const esp_err_t rtc_result = rtc_.writeTm(local);
    if (rtc_result != ESP_OK) {
      setenv("TZ", previous_timezone.c_str(), 1);
      tzset();
      timezone_posix_ = previous_timezone;
      return rtc_result;
    }
  }
  return ESP_OK;
}

std::string TimeService::resolvePosixTimezone(const DeviceConfig& config) {
  if (!config.timezone_posix.empty()) return config.timezone_posix;
  if (config.timezone == "Asia/Kolkata") return app::config::kTimezonePosixDefault;
  return app::config::kTimezonePosixDefault;
}

}  // namespace app::services
