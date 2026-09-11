#include "drivers/internal_flash_driver.h"

#include <cstdio>
#include <sys/stat.h>

#include "app_config.h"
#include "esp_littlefs.h"
#include "esp_log.h"

namespace app::drivers {

namespace {
constexpr char kTag[] = "InternalFlash";
}

esp_err_t InternalFlashDriver::mount() {
  if (mounted_) return ESP_OK;
  mount_point_ = app::config::kInternalMountPoint;
  esp_vfs_littlefs_conf_t config = {};
  config.base_path = mount_point_.c_str();
  config.partition_label = app::config::kInternalPartitionLabel;
  config.format_if_mount_failed = true;
  config.dont_mount = false;
  const esp_err_t result = esp_vfs_littlefs_register(&config);
  if (result != ESP_OK) {
    ESP_LOGE(kTag, "LittleFS mount failed: %s", esp_err_to_name(result));
    return result;
  }
  mounted_ = true;
  size_t total = 0;
  size_t used = 0;
  if (info(&total, &used) == ESP_OK) {
    ESP_LOGI(kTag, "LittleFS ready: %u/%u bytes used", static_cast<unsigned>(used), static_cast<unsigned>(total));
  }
  return ESP_OK;
}

void InternalFlashDriver::unmount() {
  if (!mounted_) return;
  esp_vfs_littlefs_unregister(app::config::kInternalPartitionLabel);
  mounted_ = false;
}

esp_err_t InternalFlashDriver::info(size_t* total_bytes, size_t* used_bytes) const {
  if (!mounted_ || total_bytes == nullptr || used_bytes == nullptr) return ESP_ERR_INVALID_STATE;
  return esp_littlefs_info(app::config::kInternalPartitionLabel, total_bytes, used_bytes);
}

bool InternalFlashDriver::exists(const std::string& path) const {
  if (!mounted_) return false;
  struct stat info = {};
  return stat(path.c_str(), &info) == 0;
}

esp_err_t InternalFlashDriver::readTextFile(const std::string& path, std::string* output) const {
  if (!mounted_ || output == nullptr) return ESP_ERR_INVALID_STATE;
  FILE* file = std::fopen(path.c_str(), "rb");
  if (file == nullptr) return ESP_ERR_NOT_FOUND;
  std::fseek(file, 0, SEEK_END);
  const long size = std::ftell(file);
  std::rewind(file);
  if (size < 0) {
    std::fclose(file);
    return ESP_FAIL;
  }
  output->assign(static_cast<size_t>(size), '\0');
  const size_t read = std::fread(output->data(), 1, output->size(), file);
  std::fclose(file);
  return read == output->size() ? ESP_OK : ESP_FAIL;
}

esp_err_t InternalFlashDriver::writeTextFile(const std::string& path, const std::string& content) const {
  if (!mounted_) return ESP_ERR_INVALID_STATE;
  FILE* file = std::fopen(path.c_str(), "wb");
  if (file == nullptr) return ESP_FAIL;
  const size_t written = std::fwrite(content.data(), 1, content.size(), file);
  std::fclose(file);
  return written == content.size() ? ESP_OK : ESP_FAIL;
}

}  // namespace app::drivers
