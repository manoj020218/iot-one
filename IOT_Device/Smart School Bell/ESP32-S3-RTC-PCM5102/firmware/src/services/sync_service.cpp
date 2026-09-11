#include "services/sync_service.h"

namespace app::services {

esp_err_t SyncService::init() {
  in_progress_ = false;
  return ESP_OK;
}

void SyncService::tick() {}

esp_err_t SyncService::requestSync() {
  in_progress_ = true;
  log_service_.info("sync", "Sync requested; transport not implemented in scaffold");
  in_progress_ = false;
  return ESP_ERR_NOT_SUPPORTED;
}

}  // namespace app::services
