#include "services/storage_service.h"

#include <cstdio>

#include "esp_check.h"
#include "utils/file_utils.h"

namespace app::services {

esp_err_t StorageService::init() {
  const esp_err_t internal_result = internal_.mount();
  internal_ready_ = (internal_result == ESP_OK);
  if (!internal_ready_) return internal_result;

  utils::ensureDirectory(rootPath() + "/sounds");
  utils::ensureDirectory(rootPath() + "/logs");
  utils::ensureDirectory(rootPath() + "/festival");

  const esp_err_t sd_result = sd_.mount();
  sd_ready_ = (sd_result == ESP_OK);
  return ESP_OK;
}

esp_err_t StorageService::formatFat32() {
  sd_ready_ = false;
  const esp_err_t err = sd_.formatFat32();
  sd_ready_ = (err == ESP_OK);
  if (sd_ready_) utils::ensureDirectory(sdRootPath() + "/bells");
  return err;
}

std::string StorageService::rootPath() const {
  return internal_.mountPoint();
}

std::string StorageService::sdRootPath() const {
  return sd_.mountPoint();
}

esp_err_t StorageService::internalInfo(size_t* total_bytes, size_t* used_bytes) const {
  return internal_.info(total_bytes, used_bytes);
}

bool StorageService::exists(const std::string& path) const {
  if (path.rfind(sd_.mountPoint(), 0) == 0) return sd_ready_ && sd_.exists(path);
  return internal_ready_ && internal_.exists(path);
}

esp_err_t StorageService::readText(const std::string& path, std::string* output) const {
  if (path.rfind(sd_.mountPoint(), 0) == 0) {
    return sd_ready_ ? sd_.readTextFile(path, output) : ESP_ERR_INVALID_STATE;
  }
  return internal_ready_ ? internal_.readTextFile(path, output) : ESP_ERR_INVALID_STATE;
}

esp_err_t StorageService::writeTextAtomic(const std::string& path, const std::string& content) const {
  const bool on_sd = path.rfind(sd_.mountPoint(), 0) == 0;
  if ((on_sd && !sd_ready_) || (!on_sd && !internal_ready_)) return ESP_ERR_INVALID_STATE;

  const std::string temp_path = path + ".tmp";
  if (!utils::ensureDirectoryForFile(path)) {
    return ESP_FAIL;
  }

  const esp_err_t write_result = on_sd ? sd_.writeTextFile(temp_path, content)
                                       : internal_.writeTextFile(temp_path, content);
  ESP_RETURN_ON_ERROR(write_result, "StorageService", "temp write failed");

  std::remove(path.c_str());
  if (std::rename(temp_path.c_str(), path.c_str()) != 0) {
    return ESP_FAIL;
  }
  return ESP_OK;
}

}  // namespace app::services
