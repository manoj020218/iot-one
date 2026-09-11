#include "services/schedule_service.h"

#include <algorithm>
#include <cctype>
#include <cstdio>

#include "app_config.h"
#include "cJSON.h"
#include "utils/json_utils.h"

namespace app::services {

namespace {

bool safeId(const std::string& value) {
  if (value.empty() || value.size() > 40) return false;
  return std::all_of(value.begin(), value.end(), [](unsigned char c) {
    return std::isalnum(c) || c == '-' || c == '_';
  });
}

bool validDate(const std::string& value) {
  if (value.empty()) return true;
  int year = 0, month = 0, day = 0;
  char tail = 0;
  if (std::sscanf(value.c_str(), "%d-%d-%d%c", &year, &month, &day, &tail) != 3 || value.size() != 10) return false;
  if (year < 2024 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  std::tm input{};
  input.tm_year = year - 1900;
  input.tm_mon = month - 1;
  input.tm_mday = day;
  input.tm_isdst = -1;
  std::tm normalized = input;
  if (std::mktime(&normalized) < 0) return false;
  return normalized.tm_year == input.tm_year && normalized.tm_mon == input.tm_mon && normalized.tm_mday == input.tm_mday;
}

void addDays(cJSON* parent, const std::array<bool, 7>& enabled) {
  cJSON* days = cJSON_AddArrayToObject(parent, "days");
  for (size_t day = 0; day < enabled.size(); ++day) {
    if (enabled[day]) cJSON_AddItemToArray(days, cJSON_CreateNumber(day));
  }
}

void addSchedule(cJSON* list, const ScheduleEntry& entry) {
  cJSON* item = cJSON_CreateObject();
  cJSON_AddNumberToObject(item, "id", static_cast<double>(entry.id));
  cJSON_AddStringToObject(item, "name", entry.name.c_str());
  cJSON_AddStringToObject(item, "time", entry.time_hhmm.c_str());
  cJSON_AddStringToObject(item, "type", entry.type.c_str());
  cJSON_AddStringToObject(item, "sound_id", entry.sound_id.c_str());
  cJSON_AddNumberToObject(item, "duration", entry.duration_seconds);
  addDays(item, entry.days_enabled);
  cJSON_AddBoolToObject(item, "enabled", entry.enabled);
  cJSON_AddItemToArray(list, item);
}

}  // namespace

esp_err_t ScheduleService::load() {
  std::string raw;
  std::string active;
  bool automation_enabled = true;
  std::vector<ScheduleProfile> profiles;
  std::vector<CalendarRule> rules;
  if (storage_.readText(app::config::kScheduleProfilesPath, &raw) == ESP_OK) {
    const esp_err_t result = parseProfiles(raw, &active, &automation_enabled, &profiles, &rules);
    if (result != ESP_OK) return result;
  } else {
    std::vector<ScheduleEntry> legacy;
    if (storage_.readText(app::config::kSchedulesPath, &raw) == ESP_OK) {
      const esp_err_t result = parse(raw, &legacy);
      if (result != ESP_OK) return result;
    }
    ScheduleProfile regular;
    regular.schedules = std::move(legacy);
    active = regular.id;
    profiles.push_back(std::move(regular));
  }

  std::lock_guard<std::mutex> lock(mutex_);
  active_profile_id_ = std::move(active);
  automation_enabled_ = automation_enabled;
  profiles_ = std::move(profiles);
  calendar_rules_ = std::move(rules);
  executed_keys_.clear();
  active_date_.clear();
  return ESP_OK;
}

esp_err_t ScheduleService::replaceFromJson(const std::string& raw_schedules) {
  std::vector<ScheduleEntry> parsed;
  const esp_err_t parsed_result = parse(raw_schedules, &parsed);
  if (parsed_result != ESP_OK) return parsed_result;

  std::lock_guard<std::mutex> lock(mutex_);
  auto found = std::find_if(profiles_.begin(), profiles_.end(), [this](const ScheduleProfile& value) {
    return value.id == active_profile_id_;
  });
  if (found == profiles_.end()) return ESP_ERR_INVALID_STATE;
  const std::vector<ScheduleEntry> previous = found->schedules;
  found->schedules = std::move(parsed);
  const esp_err_t result = saveProfilesLocked();
  if (result != ESP_OK) {
    found->schedules = previous;
    return result;
  }
  storage_.writeTextAtomic(app::config::kSchedulesPath, raw_schedules);
  executed_keys_.clear();
  active_date_.clear();
  return ESP_OK;
}

esp_err_t ScheduleService::replaceProfilesFromJson(const std::string& raw_profiles) {
  std::string active;
  bool automation_enabled = true;
  std::vector<ScheduleProfile> profiles;
  std::vector<CalendarRule> rules;
  const esp_err_t parsed_result = parseProfiles(raw_profiles, &active, &automation_enabled, &profiles, &rules);
  if (parsed_result != ESP_OK) return parsed_result;
  const esp_err_t write_result = storage_.writeTextAtomic(app::config::kScheduleProfilesPath, raw_profiles);
  if (write_result != ESP_OK) return write_result;

  std::lock_guard<std::mutex> lock(mutex_);
  active_profile_id_ = std::move(active);
  automation_enabled_ = automation_enabled;
  profiles_ = std::move(profiles);
  calendar_rules_ = std::move(rules);
  executed_keys_.clear();
  active_date_.clear();
  return ESP_OK;
}

esp_err_t ScheduleService::setActiveProfile(const std::string& profile_id) {
  std::lock_guard<std::mutex> lock(mutex_);
  const ScheduleProfile* profile = findProfileLocked(profile_id);
  if (profile == nullptr || !profile->enabled) return ESP_ERR_NOT_FOUND;
  const std::string previous = active_profile_id_;
  active_profile_id_ = profile_id;
  const esp_err_t result = saveProfilesLocked();
  if (result != ESP_OK) {
    active_profile_id_ = previous;
    return result;
  }
  executed_keys_.clear();
  active_date_.clear();
  return ESP_OK;
}

esp_err_t ScheduleService::setAutomationEnabled(bool enabled) {
  std::lock_guard<std::mutex> lock(mutex_);
  const bool previous = automation_enabled_;
  automation_enabled_ = enabled;
  const esp_err_t result = saveProfilesLocked();
  if (result != ESP_OK) {
    automation_enabled_ = previous;
    return result;
  }
  return ESP_OK;
}

esp_err_t ScheduleService::parse(const std::string& raw_schedules, std::vector<ScheduleEntry>* parsed) const {
  if (parsed == nullptr) return ESP_ERR_INVALID_ARG;
  parsed->clear();
  cJSON* root = utils::parseJson(raw_schedules);
  if (root == nullptr || !cJSON_IsArray(root)) {
    cJSON_Delete(root);
    return ESP_ERR_INVALID_ARG;
  }

  const cJSON* item = nullptr;
  cJSON_ArrayForEach(item, root) {
    if (!cJSON_IsObject(item)) {
      cJSON_Delete(root);
      return ESP_ERR_INVALID_ARG;
    }
    ScheduleEntry entry;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "id"); cJSON_IsNumber(value)) entry.id = static_cast<int64_t>(value->valuedouble);
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "name"); cJSON_IsString(value)) entry.name = value->valuestring;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "time"); cJSON_IsString(value)) entry.time_hhmm = value->valuestring;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "type"); cJSON_IsString(value)) entry.type = value->valuestring;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "sound_id"); cJSON_IsString(value)) entry.sound_id = value->valuestring;
    else if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "sound"); cJSON_IsString(value)) entry.sound_id = value->valuestring;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "duration"); cJSON_IsNumber(value)) {
      entry.duration_seconds = static_cast<uint32_t>(std::clamp(value->valuedouble, 0.0, static_cast<double>(app::config::kMaxBellDurationSeconds)));
    }
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "enabled"); cJSON_IsBool(value)) entry.enabled = cJSON_IsTrue(value);
    if (const cJSON* days = cJSON_GetObjectItemCaseSensitive(item, "days"); cJSON_IsArray(days)) {
      entry.days_enabled.fill(false);
      const cJSON* day = nullptr;
      cJSON_ArrayForEach(day, days) {
        if (!cJSON_IsNumber(day) || day->valueint < 0 || day->valueint > 6) {
          cJSON_Delete(root);
          return ESP_ERR_INVALID_ARG;
        }
        entry.days_enabled[static_cast<size_t>(day->valueint)] = true;
      }
    } else {
      entry.days_enabled = {false, true, true, true, true, true, false};
    }
    int hour = -1, minute = -1;
    if (entry.id < 0 || entry.name.empty() || entry.name.size() > 96 || entry.type.size() > 32 ||
        entry.sound_id.empty() || entry.sound_id.size() > 1024 || !ScheduleEntry::parseTimeHhMm(entry.time_hhmm, hour, minute)) {
      cJSON_Delete(root);
      return ESP_ERR_INVALID_ARG;
    }
    parsed->push_back(std::move(entry));
    if (parsed->size() > 256) {
      cJSON_Delete(root);
      return ESP_ERR_INVALID_SIZE;
    }
  }
  cJSON_Delete(root);
  return ESP_OK;
}

esp_err_t ScheduleService::parseProfiles(
    const std::string& raw_profiles,
    std::string* active_profile_id,
    bool* automation_enabled,
    std::vector<ScheduleProfile>* profiles,
    std::vector<CalendarRule>* rules) const {
  if (active_profile_id == nullptr || automation_enabled == nullptr || profiles == nullptr || rules == nullptr) return ESP_ERR_INVALID_ARG;
  active_profile_id->clear();
  *automation_enabled = true;
  profiles->clear();
  rules->clear();
  cJSON* root = utils::parseJson(raw_profiles);
  if (!cJSON_IsObject(root)) {
    cJSON_Delete(root);
    return ESP_ERR_INVALID_ARG;
  }
  if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(root, "active_profile_id"); cJSON_IsString(value)) *active_profile_id = value->valuestring;
  if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(root, "automation_enabled"); cJSON_IsBool(value)) *automation_enabled = cJSON_IsTrue(value);
  const cJSON* profile_list = cJSON_GetObjectItemCaseSensitive(root, "profiles");
  if (!cJSON_IsArray(profile_list)) {
    cJSON_Delete(root);
    return ESP_ERR_INVALID_ARG;
  }
  const cJSON* item = nullptr;
  cJSON_ArrayForEach(item, profile_list) {
    if (!cJSON_IsObject(item)) {
      cJSON_Delete(root);
      return ESP_ERR_INVALID_ARG;
    }
    ScheduleProfile profile;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "id"); cJSON_IsString(value)) profile.id = value->valuestring;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "name"); cJSON_IsString(value)) profile.name = value->valuestring;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "category"); cJSON_IsString(value)) profile.category = value->valuestring;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "enabled"); cJSON_IsBool(value)) profile.enabled = cJSON_IsTrue(value);
    const cJSON* schedule_list = cJSON_GetObjectItemCaseSensitive(item, "schedules");
    char* schedule_json = cJSON_IsArray(schedule_list) ? cJSON_PrintUnformatted(schedule_list) : nullptr;
    const esp_err_t parse_result = schedule_json == nullptr ? ESP_ERR_INVALID_ARG : parse(schedule_json, &profile.schedules);
    cJSON_free(schedule_json);
    if (parse_result != ESP_OK || !safeId(profile.id) || profile.name.empty() || profile.name.size() > 96 || profile.category.size() > 32 ||
        std::any_of(profiles->begin(), profiles->end(), [&profile](const ScheduleProfile& value) { return value.id == profile.id; })) {
      cJSON_Delete(root);
      return ESP_ERR_INVALID_ARG;
    }
    profiles->push_back(std::move(profile));
    if (profiles->size() > 16) {
      cJSON_Delete(root);
      return ESP_ERR_INVALID_SIZE;
    }
  }
  if (profiles->empty()) {
    cJSON_Delete(root);
    return ESP_ERR_INVALID_ARG;
  }
  if (active_profile_id->empty()) *active_profile_id = profiles->front().id;
  const auto active = std::find_if(profiles->begin(), profiles->end(), [active_profile_id](const ScheduleProfile& value) {
    return value.id == *active_profile_id && value.enabled;
  });
  if (active == profiles->end()) {
    cJSON_Delete(root);
    return ESP_ERR_INVALID_ARG;
  }

  const cJSON* rule_list = cJSON_GetObjectItemCaseSensitive(root, "calendar_rules");
  if (rule_list != nullptr && !cJSON_IsArray(rule_list)) {
    cJSON_Delete(root);
    return ESP_ERR_INVALID_ARG;
  }
  cJSON_ArrayForEach(item, rule_list) {
    if (!cJSON_IsObject(item)) {
      cJSON_Delete(root);
      return ESP_ERR_INVALID_ARG;
    }
    CalendarRule rule;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "id"); cJSON_IsNumber(value)) rule.id = static_cast<int64_t>(value->valuedouble);
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "name"); cJSON_IsString(value)) rule.name = value->valuestring;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "profile_id"); cJSON_IsString(value)) rule.profile_id = value->valuestring;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "start_date"); cJSON_IsString(value)) rule.start_date = value->valuestring;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "end_date"); cJSON_IsString(value)) rule.end_date = value->valuestring;
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "priority"); cJSON_IsNumber(value)) rule.priority = std::clamp(value->valueint, -1000, 1000);
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "repeat_yearly"); cJSON_IsBool(value)) rule.repeat_yearly = cJSON_IsTrue(value);
    if (const cJSON* value = cJSON_GetObjectItemCaseSensitive(item, "enabled"); cJSON_IsBool(value)) rule.enabled = cJSON_IsTrue(value);
    if (const cJSON* days = cJSON_GetObjectItemCaseSensitive(item, "days"); cJSON_IsArray(days)) {
      rule.days_enabled.fill(false);
      const cJSON* day = nullptr;
      cJSON_ArrayForEach(day, days) {
        if (!cJSON_IsNumber(day) || day->valueint < 0 || day->valueint > 6) {
          cJSON_Delete(root);
          return ESP_ERR_INVALID_ARG;
        }
        rule.days_enabled[static_cast<size_t>(day->valueint)] = true;
      }
    }
    const auto profile = std::find_if(profiles->begin(), profiles->end(), [&rule](const ScheduleProfile& value) {
      return value.id == rule.profile_id;
    });
    if (rule.id < 0 || rule.name.empty() || rule.name.size() > 96 || profile == profiles->end() ||
        !validDate(rule.start_date) || !validDate(rule.end_date) ||
        (!rule.start_date.empty() && !rule.end_date.empty() && rule.start_date > rule.end_date)) {
      cJSON_Delete(root);
      return ESP_ERR_INVALID_ARG;
    }
    rules->push_back(std::move(rule));
    if (rules->size() > 128) {
      cJSON_Delete(root);
      return ESP_ERR_INVALID_SIZE;
    }
  }
  cJSON_Delete(root);
  return ESP_OK;
}

esp_err_t ScheduleService::saveProfilesLocked() const {
  cJSON* root = cJSON_CreateObject();
  if (root == nullptr) return ESP_ERR_NO_MEM;
  cJSON_AddStringToObject(root, "active_profile_id", active_profile_id_.c_str());
  cJSON_AddBoolToObject(root, "automation_enabled", automation_enabled_);
  cJSON* profile_list = cJSON_AddArrayToObject(root, "profiles");
  for (const ScheduleProfile& profile : profiles_) {
    cJSON* item = cJSON_CreateObject();
    cJSON_AddStringToObject(item, "id", profile.id.c_str());
    cJSON_AddStringToObject(item, "name", profile.name.c_str());
    cJSON_AddStringToObject(item, "category", profile.category.c_str());
    cJSON_AddBoolToObject(item, "enabled", profile.enabled);
    cJSON* schedules = cJSON_AddArrayToObject(item, "schedules");
    for (const ScheduleEntry& entry : profile.schedules) addSchedule(schedules, entry);
    cJSON_AddItemToArray(profile_list, item);
  }
  cJSON* rule_list = cJSON_AddArrayToObject(root, "calendar_rules");
  for (const CalendarRule& rule : calendar_rules_) {
    cJSON* item = cJSON_CreateObject();
    cJSON_AddNumberToObject(item, "id", static_cast<double>(rule.id));
    cJSON_AddStringToObject(item, "name", rule.name.c_str());
    cJSON_AddStringToObject(item, "profile_id", rule.profile_id.c_str());
    cJSON_AddStringToObject(item, "start_date", rule.start_date.c_str());
    cJSON_AddStringToObject(item, "end_date", rule.end_date.c_str());
    cJSON_AddNumberToObject(item, "priority", rule.priority);
    cJSON_AddBoolToObject(item, "repeat_yearly", rule.repeat_yearly);
    addDays(item, rule.days_enabled);
    cJSON_AddBoolToObject(item, "enabled", rule.enabled);
    cJSON_AddItemToArray(rule_list, item);
  }
  char* payload = cJSON_PrintUnformatted(root);
  cJSON_Delete(root);
  if (payload == nullptr) return ESP_ERR_NO_MEM;
  const esp_err_t result = storage_.writeTextAtomic(app::config::kScheduleProfilesPath, payload);
  cJSON_free(payload);
  return result;
}

const ScheduleProfile* ScheduleService::findProfileLocked(const std::string& profile_id) const {
  const auto found = std::find_if(profiles_.begin(), profiles_.end(), [&profile_id](const ScheduleProfile& value) {
    return value.id == profile_id;
  });
  return found == profiles_.end() ? nullptr : &*found;
}

std::string ScheduleService::resolvedProfileIdLocked(const std::tm& now) const {
  std::string selected = active_profile_id_;
  int selected_priority = -1001;
  for (const CalendarRule& rule : calendar_rules_) {
    const ScheduleProfile* profile = findProfileLocked(rule.profile_id);
    if (profile != nullptr && profile->enabled && rule.matches(now) && rule.priority > selected_priority) {
      selected = rule.profile_id;
      selected_priority = rule.priority;
    }
  }
  const ScheduleProfile* selected_profile = findProfileLocked(selected);
  if (selected_profile != nullptr && selected_profile->enabled) return selected;
  const auto fallback = std::find_if(profiles_.begin(), profiles_.end(), [](const ScheduleProfile& value) { return value.enabled; });
  return fallback == profiles_.end() ? std::string{} : fallback->id;
}

std::vector<ScheduleEntry> ScheduleService::dueSchedules(const std::tm& now) {
  std::lock_guard<std::mutex> lock(mutex_);
  std::vector<ScheduleEntry> due;
  const std::string today = formatDate(now);
  if (active_date_ != today) {
    active_date_ = today;
    executed_keys_.clear();
  }
  const std::string profile_id = resolvedProfileIdLocked(now);
  const ScheduleProfile* profile = findProfileLocked(profile_id);
  if (profile == nullptr) return due;
  for (const ScheduleEntry& schedule : profile->schedules) {
    if (!schedule.matches(now)) continue;
    const std::string key = profile_id + "|" + schedule.executionKey(now);
    if (!executed_keys_.insert(key).second) continue;
    if (automation_enabled_) due.push_back(schedule);
  }
  return due;
}

std::vector<ScheduleEntry> ScheduleService::schedules() const {
  std::lock_guard<std::mutex> lock(mutex_);
  const ScheduleProfile* profile = findProfileLocked(active_profile_id_);
  return profile == nullptr ? std::vector<ScheduleEntry>{} : profile->schedules;
}

std::vector<ScheduleProfile> ScheduleService::profiles() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return profiles_;
}

std::vector<CalendarRule> ScheduleService::calendarRules() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return calendar_rules_;
}

std::string ScheduleService::activeProfileId() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return active_profile_id_;
}

bool ScheduleService::automationEnabled() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return automation_enabled_;
}

std::string ScheduleService::resolvedProfileId(const std::tm& now) const {
  std::lock_guard<std::mutex> lock(mutex_);
  return resolvedProfileIdLocked(now);
}

}  // namespace app::services
