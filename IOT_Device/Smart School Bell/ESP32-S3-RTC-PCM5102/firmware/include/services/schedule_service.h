#pragma once

#include <string>
#include <mutex>
#include <unordered_set>
#include <vector>

#include "app_types.h"
#include "esp_err.h"
#include "services/storage_service.h"

namespace app::services {

class ScheduleService {
 public:
  explicit ScheduleService(StorageService& storage) : storage_(storage) {}

  esp_err_t load();
  esp_err_t replaceFromJson(const std::string& raw_schedules);
  esp_err_t replaceProfilesFromJson(const std::string& raw_profiles);
  esp_err_t setActiveProfile(const std::string& profile_id);
  esp_err_t setAutomationEnabled(bool enabled);
  std::vector<ScheduleEntry> dueSchedules(const std::tm& now);
  std::vector<ScheduleEntry> schedules() const;
  std::vector<ScheduleProfile> profiles() const;
  std::vector<CalendarRule> calendarRules() const;
  std::string activeProfileId() const;
  bool automationEnabled() const;
  std::string resolvedProfileId(const std::tm& now) const;

 private:
  esp_err_t parse(const std::string& raw_schedules, std::vector<ScheduleEntry>* parsed) const;
  esp_err_t parseProfiles(
      const std::string& raw_profiles,
      std::string* active_profile_id,
      bool* automation_enabled,
      std::vector<ScheduleProfile>* profiles,
      std::vector<CalendarRule>* rules) const;
  esp_err_t saveProfilesLocked() const;
  const ScheduleProfile* findProfileLocked(const std::string& profile_id) const;
  std::string resolvedProfileIdLocked(const std::tm& now) const;

  StorageService& storage_;
  mutable std::mutex mutex_;
  std::string active_profile_id_ = "regular";
  bool automation_enabled_ = true;
  std::vector<ScheduleProfile> profiles_;
  std::vector<CalendarRule> calendar_rules_;
  std::string active_date_;
  std::unordered_set<std::string> executed_keys_;
};

}  // namespace app::services
