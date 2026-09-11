#pragma once

#include <mutex>
#include <string>
#include <vector>

#include "esp_err.h"
#include "services/storage_service.h"

namespace app::services {

class LogService {
 public:
  explicit LogService(StorageService& storage) : storage_(storage) {}

  esp_err_t init();
  void info(const std::string& event, const std::string& detail = {});
  void warn(const std::string& event, const std::string& detail = {});
  void error(const std::string& event, const std::string& detail = {});
  std::vector<std::string> recent(size_t limit) const;
  esp_err_t clear();

 private:
  void append(const char* level, const std::string& event, const std::string& detail);

  StorageService& storage_;
  mutable std::mutex mutex_;
  bool ready_ = false;
};

}  // namespace app::services
