#pragma once

#include <string>

#include "drivers/internal_flash_driver.h"
#include "drivers/sd_driver.h"
#include "esp_err.h"

namespace app::services {

class StorageService {
 public:
  StorageService(drivers::InternalFlashDriver& internal, drivers::SdDriver& sd)
      : internal_(internal), sd_(sd) {}

  esp_err_t init();
  esp_err_t formatFat32();
  bool isReady() const { return internal_ready_; }
  bool sdReady() const { return sd_ready_; }
  std::string rootPath() const;
  std::string sdRootPath() const;
  esp_err_t internalInfo(size_t* total_bytes, size_t* used_bytes) const;
  bool exists(const std::string& path) const;
  esp_err_t readText(const std::string& path, std::string* output) const;
  esp_err_t writeTextAtomic(const std::string& path, const std::string& content) const;

 private:
  drivers::InternalFlashDriver& internal_;
  drivers::SdDriver& sd_;
  bool internal_ready_ = false;
  bool sd_ready_ = false;
};

}  // namespace app::services
