#include "drivers/sd_driver.h"

#include <cstdio>
#include <sys/stat.h>

#include "app_config.h"
#include "board_pins.h"
#include "driver/sdmmc_host.h"
#include "esp_check.h"
#include "esp_log.h"
#include "esp_vfs_fat.h"

namespace app::drivers {

namespace {
constexpr char kTag[] = "SdDriver";

sdmmc_slot_config_t makeSlotConfig(int width) {
  sdmmc_slot_config_t config = SDMMC_SLOT_CONFIG_DEFAULT();
  config.width = width;
  config.clk = board::kSdClk;
  config.cmd = board::kSdCmd;
  config.d0 = board::kSdD0;
  config.d1 = width >= 4 ? board::kSdD1 : GPIO_NUM_NC;
  config.d2 = width >= 4 ? board::kSdD2 : GPIO_NUM_NC;
  config.d3 = width >= 4 ? board::kSdD3 : GPIO_NUM_NC;
  config.gpio_cd = board::kSdCardDetect;
  config.gpio_wp = GPIO_NUM_NC;
  config.flags |= SDMMC_SLOT_FLAG_INTERNAL_PULLUP;
  return config;
}

esp_err_t mountCard(const char* mount_point, int width, bool format_if_mount_failed, sdmmc_card_t** card) {
  sdmmc_host_t host = SDMMC_HOST_DEFAULT();
  host.max_freq_khz = 4000;

  esp_vfs_fat_sdmmc_mount_config_t mount_config = {};
  mount_config.format_if_mount_failed = format_if_mount_failed;
  mount_config.max_files = 8;
  mount_config.allocation_unit_size = 16 * 1024;

  sdmmc_slot_config_t slot_config = makeSlotConfig(width);
  return esp_vfs_fat_sdmmc_mount(mount_point, &host, &slot_config, &mount_config, card);
}
}

esp_err_t SdDriver::mount() {
  if (mounted_) {
    return ESP_OK;
  }

  if (board::kSdClk == GPIO_NUM_NC || board::kSdCmd == GPIO_NUM_NC || board::kSdD0 == GPIO_NUM_NC) {
    ESP_LOGW(kTag, "SDMMC pins unresolved in board_pins.h");
    return ESP_ERR_INVALID_STATE;
  }

  mount_point_ = app::config::kSdMountPoint;
  esp_err_t err = mountCard(mount_point_.c_str(), board::kSdBusWidth, false, &card_);
  if (err != ESP_OK && board::kSdBusWidth > 1) {
    ESP_LOGW(kTag, "SDMMC %d-bit mount failed (%s), trying 1-bit", board::kSdBusWidth, esp_err_to_name(err));
    err = mountCard(mount_point_.c_str(), 1, false, &card_);
  }
  if (err != ESP_OK) return err;

  mounted_ = true;
  return ESP_OK;
}

esp_err_t SdDriver::formatFat32() {
  if (mounted_) {
    return esp_vfs_fat_sdcard_format(mount_point_.c_str(), card_);
  }

  mount_point_ = app::config::kSdMountPoint;
  esp_err_t err = mountCard(mount_point_.c_str(), board::kSdBusWidth, true, &card_);
  if (err != ESP_OK && board::kSdBusWidth > 1) {
    ESP_LOGW(kTag, "SDMMC format/mount in %d-bit mode failed (%s), trying 1-bit", board::kSdBusWidth, esp_err_to_name(err));
    err = mountCard(mount_point_.c_str(), 1, true, &card_);
  }
  if (err != ESP_OK) return err;

  mounted_ = true;
  return ESP_OK;
}

void SdDriver::unmount() {
  if (!mounted_) {
    return;
  }

  esp_vfs_fat_sdcard_unmount(mount_point_.c_str(), card_);
  card_ = nullptr;
  mounted_ = false;
}

bool SdDriver::exists(const std::string& path) const {
  const std::string resolved = resolvePath(path);
  struct stat info = {};
  return mounted_ && stat(resolved.c_str(), &info) == 0;
}

esp_err_t SdDriver::readTextFile(const std::string& path, std::string* output) const {
  if (!mounted_ || output == nullptr) {
    return ESP_ERR_INVALID_STATE;
  }

  const std::string resolved = resolvePath(path);
  FILE* file = std::fopen(resolved.c_str(), "rb");
  if (file == nullptr) {
    return ESP_ERR_NOT_FOUND;
  }

  std::fseek(file, 0, SEEK_END);
  const long size = std::ftell(file);
  std::rewind(file);

  if (size < 0) {
    std::fclose(file);
    return ESP_FAIL;
  }

  output->assign(static_cast<size_t>(size), '\0');
  const size_t bytes_read = std::fread(output->data(), 1, static_cast<size_t>(size), file);
  std::fclose(file);

  if (bytes_read != static_cast<size_t>(size)) {
    return ESP_FAIL;
  }

  return ESP_OK;
}

esp_err_t SdDriver::writeTextFile(const std::string& path, const std::string& content) const {
  if (!mounted_) {
    return ESP_ERR_INVALID_STATE;
  }

  const std::string resolved = resolvePath(path);
  FILE* file = std::fopen(resolved.c_str(), "wb");
  if (file == nullptr) {
    return ESP_FAIL;
  }

  const size_t bytes_written = std::fwrite(content.data(), 1, content.size(), file);
  std::fclose(file);
  return bytes_written == content.size() ? ESP_OK : ESP_FAIL;
}

std::string SdDriver::resolvePath(const std::string& path) const {
  if (path.rfind(mount_point_, 0) == 0) {
    return path;
  }

  if (!path.empty() && path.front() == '/') {
    return path;
  }

  return mount_point_ + "/" + path;
}

}  // namespace app::drivers
