#include "services/holiday_service.h"

#include <cstdio>

#include "app_config.h"
#include "utils/json_utils.h"

namespace app::services {

esp_err_t HolidayService::load() {
  std::string raw_holidays;
  if (storage_.readText(app::config::kHolidaysPath, &raw_holidays) != ESP_OK) {
    std::lock_guard<std::mutex> lock(mutex_);
    holidays_.clear();
    holiday_dates_.clear();
    return ESP_OK;
  }

  std::vector<HolidayEntry> parsed;
  const esp_err_t result = parse(raw_holidays, &parsed);
  if (result != ESP_OK) return result;
  std::lock_guard<std::mutex> lock(mutex_);
  holidays_ = std::move(parsed);
  holiday_dates_.clear();
  for (const HolidayEntry& holiday : holidays_) holiday_dates_.insert(holiday.date);
  return ESP_OK;
}

esp_err_t HolidayService::replaceFromJson(const std::string& raw_holidays) {
  std::vector<HolidayEntry> parsed;
  const esp_err_t result = parse(raw_holidays, &parsed);
  if (result != ESP_OK) return result;
  const esp_err_t write_result = storage_.writeTextAtomic(app::config::kHolidaysPath, raw_holidays);
  if (write_result != ESP_OK) return write_result;
  std::lock_guard<std::mutex> lock(mutex_);
  holidays_ = std::move(parsed);
  holiday_dates_.clear();
  for (const HolidayEntry& holiday : holidays_) holiday_dates_.insert(holiday.date);
  return ESP_OK;
}

esp_err_t HolidayService::parse(const std::string& raw_holidays, std::vector<HolidayEntry>* parsed) const {
  if (parsed == nullptr) return ESP_ERR_INVALID_ARG;
  parsed->clear();

  cJSON* root = utils::parseJson(raw_holidays);
  if (root == nullptr || !cJSON_IsArray(root)) {
    cJSON_Delete(root);
    return ESP_FAIL;
  }

  const cJSON* item = nullptr;
  cJSON_ArrayForEach(item, root) {
    if (!cJSON_IsObject(item)) continue;

    HolidayEntry holiday;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "date"); cJSON_IsString(value)) holiday.date = value->valuestring;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "name"); cJSON_IsString(value)) holiday.name = value->valuestring;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "type"); cJSON_IsString(value)) holiday.type = value->valuestring;

    int year = 0, month = 0, day = 0;
    char tail = 0;
    if (std::sscanf(holiday.date.c_str(), "%d-%d-%d%c", &year, &month, &day, &tail) != 3 || holiday.date.size() != 10 ||
        year < 2024 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31 || holiday.name.empty() || holiday.name.size() > 96 || holiday.type.size() > 32) {
      cJSON_Delete(root);
      return ESP_ERR_INVALID_ARG;
    }
    std::tm input{};
    input.tm_year = year - 1900;
    input.tm_mon = month - 1;
    input.tm_mday = day;
    input.tm_isdst = -1;
    std::tm normalized = input;
    if (std::mktime(&normalized) < 0 || normalized.tm_year != input.tm_year || normalized.tm_mon != input.tm_mon || normalized.tm_mday != input.tm_mday) {
      cJSON_Delete(root);
      return ESP_ERR_INVALID_ARG;
    }
    parsed->push_back(std::move(holiday));
    if (parsed->size() > 512) {
      cJSON_Delete(root);
      return ESP_ERR_INVALID_SIZE;
    }
  }

  cJSON_Delete(root);
  return ESP_OK;
}

bool HolidayService::isHoliday(const std::tm& now) const {
  std::lock_guard<std::mutex> lock(mutex_);
  return holiday_dates_.find(formatDate(now)) != holiday_dates_.end();
}

std::vector<HolidayEntry> HolidayService::holidays() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return holidays_;
}

}  // namespace app::services
