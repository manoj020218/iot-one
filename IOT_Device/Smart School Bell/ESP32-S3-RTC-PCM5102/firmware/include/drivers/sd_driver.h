#pragma once

#include <string>

#include "esp_err.h"
#include "sdmmc_cmd.h"

namespace app::drivers {

class SdDriver {
 public:
  esp_err_t mount();
  esp_err_t formatFat32();
  void unmount();
  bool isMounted() const { return mounted_; }
  const std::string& mountPoint() const { return mount_point_; }
  bool exists(const std::string& path) const;
  esp_err_t readTextFile(const std::string& path, std::string* output) const;
  esp_err_t writeTextFile(const std::string& path, const std::string& content) const;

 private:
  std::string resolvePath(const std::string& path) const;

  std::string mount_point_ = "/sdcard";
  sdmmc_card_t* card_ = nullptr;
  bool mounted_ = false;
};

}  // namespace app::drivers
