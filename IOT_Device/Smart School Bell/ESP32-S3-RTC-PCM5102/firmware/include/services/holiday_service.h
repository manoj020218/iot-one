#pragma once

#include <mutex>
#include <unordered_set>
#include <vector>

#include "app_types.h"
#include "esp_err.h"
#include "services/storage_service.h"

namespace app::services {

class HolidayService {
 public:
  explicit HolidayService(StorageService& storage) : storage_(storage) {}

  esp_err_t load();
  esp_err_t replaceFromJson(const std::string& raw_holidays);
  bool isHoliday(const std::tm& now) const;
  std::vector<HolidayEntry> holidays() const;

 private:
  esp_err_t parse(const std::string& raw_holidays, std::vector<HolidayEntry>* holidays) const;

  StorageService& storage_;
  mutable std::mutex mutex_;
  std::vector<HolidayEntry> holidays_;
  std::unordered_set<std::string> holiday_dates_;
};

}  // namespace app::services
