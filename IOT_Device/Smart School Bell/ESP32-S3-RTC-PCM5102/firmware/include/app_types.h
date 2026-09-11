#pragma once

#include <array>
#include <cstdint>
#include <ctime>
#include <iomanip>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>

namespace app {

enum class AppState {
  Booting,
  RtcInvalid,
  Ready,
  Playing,
  Announcing,
  Syncing,
  Degraded,
  ErrorFatal
};

enum class LedPattern {
  Off,
  HeartbeatBoot,
  SolidReady,
  BlinkSync,
  BlinkRtcInvalid,
  BlinkFatal
};

enum class ButtonEvent {
  None,
  ShortPress,
  LongPress,
  FactoryReset
};

struct WifiConfig {
  std::string mode = "client";
  std::string ssid;
  std::string password;
};

struct SyncMetadata {
  std::string source = "sd-card";
  std::string last_sync_utc;
  uint32_t content_version = 0;
};

struct DeviceConfig {
  std::string device_id = "UNCONFIGURED";
  std::string school_name = "Jenix SchoolBell";
  std::string timezone = "Asia/Kolkata";
  std::string timezone_posix = "IST-5:30";
  uint8_t volume_percent = 80;
  bool physical_ptt_enabled = true;
  uint16_t physical_ptt_gain_percent = 200;
  WifiConfig wifi;
  SyncMetadata sync;
};

struct CloudConfig {
  bool enabled = false;
  std::string home_id;
  std::string mqtt_host = "mqtt.iotsoft.in";
  uint16_t mqtt_port = 1883;
  std::string mqtt_username;
  std::string mqtt_password;
};

struct OtaRequest {
  std::string request_id;
  std::string artifact_url;
  std::string checksum;
  std::string target_version;
};

struct SoundAsset {
  std::string sound_id;
  std::string profile_id = "sd-default";
  std::string file_path;
  std::string stream_url;
  uint32_t duration_seconds = 0;
};

struct AudioProfile {
  std::string profile_id = "sd-default";
  std::string name = "SD Card";
  std::string source_type = "sd-card";
  std::string transport = "file";
  std::string format = "wav";
  std::string endpoint;
  bool enabled = true;
};

inline std::string formatDate(const std::tm& now) {
  std::ostringstream oss;
  oss << std::put_time(&now, "%Y-%m-%d");
  return oss.str();
}

struct ScheduleEntry {
  int64_t id = 0;
  std::string name;
  std::string time_hhmm;
  std::string type = "period";
  std::string sound_id = "default";
  uint32_t duration_seconds = 5;
  std::array<bool, 7> days_enabled = {false, false, false, false, false, false, false};
  bool enabled = true;

  bool matches(const std::tm& now) const {
    if (!enabled) {
      return false;
    }

    int hour = -1;
    int minute = -1;
    if (!parseTimeHhMm(time_hhmm, hour, minute)) {
      return false;
    }

    if (now.tm_wday < 0 || now.tm_wday > 6 || !days_enabled[static_cast<size_t>(now.tm_wday)]) {
      return false;
    }

    return now.tm_hour == hour && now.tm_min == minute;
  }

  std::string executionKey(const std::tm& now) const {
    std::ostringstream oss;
    oss << formatDate(now) << "|" << time_hhmm << "|" << id;
    return oss.str();
  }

  static bool parseTimeHhMm(const std::string& value, int& hour, int& minute) {
    if (value.size() != 5 || value[2] != ':') {
      return false;
    }

    try {
      hour = std::stoi(value.substr(0, 2));
      minute = std::stoi(value.substr(3, 2));
    } catch (...) {
      return false;
    }

    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
  }
};

struct ScheduleProfile {
  std::string id = "regular";
  std::string name = "Regular Timetable";
  std::string category = "regular";
  bool enabled = true;
  std::vector<ScheduleEntry> schedules;
};

struct CalendarRule {
  int64_t id = 0;
  std::string name;
  std::string profile_id;
  std::string start_date;
  std::string end_date;
  int priority = 0;
  bool repeat_yearly = false;
  std::array<bool, 7> days_enabled = {true, true, true, true, true, true, true};
  bool enabled = true;

  bool matches(const std::tm& now) const {
    if (!enabled || now.tm_wday < 0 || now.tm_wday > 6 || !days_enabled[static_cast<size_t>(now.tm_wday)]) return false;
    const std::string today = formatDate(now);
    if (repeat_yearly) {
      const std::string month_day = today.substr(5);
      const std::string start = start_date.empty() ? "" : start_date.substr(5);
      const std::string end = end_date.empty() ? "" : end_date.substr(5);
      if (start.empty()) return end.empty() || month_day <= end;
      if (end.empty()) return month_day >= start;
      return start <= end ? (month_day >= start && month_day <= end) : (month_day >= start || month_day <= end);
    }
    return (start_date.empty() || today >= start_date) && (end_date.empty() || today <= end_date);
  }
};

struct HolidayEntry {
  std::string date;
  std::string name;
  std::string type = "holiday";
};

struct RingRequest {
  std::string name = "Manual Ring";
  std::string sound_id = "default";
  uint32_t duration_seconds = 5;
  std::string trigger_source = "manual";
};

struct RuntimeSnapshot {
  AppState state = AppState::Booting;
  bool time_valid = false;
  bool sd_ready = false;
  bool wifi_ready = false;
  bool sync_in_progress = false;
  uint32_t content_version = 0;
  std::string device_id;
  std::string school_name;
  std::string last_fault;
};

inline const char* toString(AppState state) {
  switch (state) {
    case AppState::Booting:
      return "BOOTING";
    case AppState::RtcInvalid:
      return "RTC_INVALID";
    case AppState::Ready:
      return "READY";
    case AppState::Playing:
      return "PLAYING";
    case AppState::Announcing:
      return "ANNOUNCING";
    case AppState::Syncing:
      return "SYNCING";
    case AppState::Degraded:
      return "DEGRADED";
    case AppState::ErrorFatal:
      return "ERROR_FATAL";
    default:
      return "UNKNOWN";
  }
}

using SoundManifest = std::unordered_map<std::string, SoundAsset>;
using AudioProfileMap = std::unordered_map<std::string, AudioProfile>;

}  // namespace app
