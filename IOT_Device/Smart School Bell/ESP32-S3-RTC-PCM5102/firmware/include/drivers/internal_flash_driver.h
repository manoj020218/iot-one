#pragma once

#include <cstddef>
#include <string>

#include "esp_err.h"

namespace app::drivers {

class InternalFlashDriver {
 public:
  esp_err_t mount();
  void unmount();
  bool isMounted() const { return mounted_; }
  const std::string& mountPoint() const { return mount_point_; }
  esp_err_t info(size_t* total_bytes, size_t* used_bytes) const;
  bool exists(const std::string& path) const;
  esp_err_t readTextFile(const std::string& path, std::string* output) const;
  esp_err_t writeTextFile(const std::string& path, const std::string& content) const;

 private:
  std::string mount_point_ = "/flash";
  bool mounted_ = false;
};

}  // namespace app::drivers
