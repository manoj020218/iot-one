#pragma once

#include <functional>
#include <string>

#include "app_types.h"
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

namespace app::services {

class OtaService {
 public:
  using CompletionHandler =
      std::function<void(const OtaRequest&, bool, const std::string&)>;

  esp_err_t init();
  esp_err_t request(const OtaRequest& request, CompletionHandler completion);
  bool active() const;
  std::string status() const;
  std::string message() const;

 private:
  struct TaskContext;
  static void taskEntry(void* context);
  esp_err_t perform(const OtaRequest& request, std::string* error_message);
  void setState(bool active, const char* status, const std::string& message);

  mutable SemaphoreHandle_t mutex_ = nullptr;
  bool active_ = false;
  std::string status_ = "idle";
  std::string message_;
};

}  // namespace app::services
