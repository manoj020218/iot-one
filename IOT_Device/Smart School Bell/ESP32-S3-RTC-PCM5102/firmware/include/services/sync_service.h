#pragma once

#include "esp_err.h"
#include "services/log_service.h"

namespace app::services {

class SyncService {
 public:
  explicit SyncService(LogService& log_service) : log_service_(log_service) {}

  esp_err_t init();
  void tick();
  esp_err_t requestSync();
  bool inProgress() const { return in_progress_; }

 private:
  LogService& log_service_;
  bool in_progress_ = false;
};

}  // namespace app::services
