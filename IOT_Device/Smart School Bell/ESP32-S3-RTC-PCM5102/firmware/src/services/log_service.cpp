#include "services/log_service.h"

#include <algorithm>
#include <cstddef>
#include <cstdio>
#include <ctime>
#include <sstream>
#include <vector>

#include "app_config.h"
#include "esp_log.h"
#include "utils/file_utils.h"

namespace app::services {

namespace {
constexpr char kTag[] = "LogService";
}

esp_err_t LogService::init() {
  std::lock_guard<std::mutex> lock(mutex_);
  ready_ = storage_.isReady() && utils::ensureDirectoryForFile(app::config::kRuntimeLogPath);
  return ESP_OK;
}

void LogService::info(const std::string& event, const std::string& detail) {
  append("INFO", event, detail);
}

void LogService::warn(const std::string& event, const std::string& detail) {
  append("WARN", event, detail);
}

void LogService::error(const std::string& event, const std::string& detail) {
  append("ERROR", event, detail);
}

void LogService::append(const char* level, const std::string& event, const std::string& detail) {
  std::time_t now = std::time(nullptr);
  std::tm local_now = {};
  localtime_r(&now, &local_now);

  char timestamp[32] = {};
  std::strftime(timestamp, sizeof(timestamp), "%Y-%m-%d %H:%M:%S", &local_now);

  std::ostringstream line;
  line << timestamp << " [" << level << "] " << event;
  if (!detail.empty()) line << " :: " << detail;
  line << "\n";

  if (std::string(level) == "ERROR") ESP_LOGE(kTag, "%s", line.str().c_str());
  else if (std::string(level) == "WARN") ESP_LOGW(kTag, "%s", line.str().c_str());
  else ESP_LOGI(kTag, "%s", line.str().c_str());

  std::lock_guard<std::mutex> lock(mutex_);
  if (!ready_) return;

  FILE* file = std::fopen(app::config::kRuntimeLogPath, "ab");
  if (file == nullptr) return;
  const std::string text = line.str();
  std::fwrite(text.data(), 1, text.size(), file);
  std::fclose(file);
}

std::vector<std::string> LogService::recent(size_t limit) const {
  std::lock_guard<std::mutex> lock(mutex_);
  std::vector<std::string> result;
  if (!ready_ || limit == 0) return result;
  FILE* file = std::fopen(app::config::kRuntimeLogPath, "rb");
  if (file == nullptr) return result;
  std::fseek(file, 0, SEEK_END);
  const long size = std::ftell(file);
  const long read_size = std::min<long>(size < 0 ? 0 : size, 64 * 1024);
  std::fseek(file, size > read_size ? size - read_size : 0, SEEK_SET);
  std::string text(static_cast<size_t>(read_size), '\0');
  const size_t count = read_size > 0 ? std::fread(text.data(), 1, static_cast<size_t>(read_size), file) : 0;
  std::fclose(file);
  text.resize(count);
  size_t cursor = 0;
  while (cursor < text.size()) {
    const size_t end = text.find('\n', cursor);
    const std::string line = text.substr(cursor, end == std::string::npos ? std::string::npos : end - cursor);
    if (!line.empty()) result.push_back(line);
    if (end == std::string::npos) break;
    cursor = end + 1;
  }
  if (result.size() > limit) result.erase(result.begin(), result.end() - static_cast<std::ptrdiff_t>(limit));
  std::reverse(result.begin(), result.end());
  return result;
}

esp_err_t LogService::clear() {
  std::lock_guard<std::mutex> lock(mutex_);
  if (!storage_.isReady()) return ESP_ERR_INVALID_STATE;
  FILE* file = std::fopen(app::config::kRuntimeLogPath, "wb");
  if (file == nullptr) return ESP_FAIL;
  std::fclose(file);
  ready_ = true;
  return ESP_OK;
}

}  // namespace app::services
