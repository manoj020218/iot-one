#include "services/ota_service.h"

#include <array>
#include <cctype>
#include <cstring>
#include <new>

#include "esp_crt_bundle.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_ota_ops.h"
#include "freertos/task.h"
#include "mbedtls/sha256.h"

namespace app::services {

namespace {
constexpr char kTag[] = "OtaService";

int hexValue(char value) {
  if (value >= '0' && value <= '9') return value - '0';
  if (value >= 'a' && value <= 'f') return value - 'a' + 10;
  if (value >= 'A' && value <= 'F') return value - 'A' + 10;
  return -1;
}

bool parseSha256(const std::string& checksum, std::array<uint8_t, 32>* output) {
  if (output == nullptr) return false;
  std::string value = checksum;
  if (value.rfind("sha256:", 0) == 0 || value.rfind("SHA256:", 0) == 0) value.erase(0, 7);
  if (value.size() != 64) return false;
  for (size_t index = 0; index < output->size(); ++index) {
    const int high = hexValue(value[index * 2]);
    const int low = hexValue(value[index * 2 + 1]);
    if (high < 0 || low < 0) return false;
    (*output)[index] = static_cast<uint8_t>((high << 4) | low);
  }
  return true;
}
}  // namespace

struct OtaService::TaskContext {
  OtaService* service = nullptr;
  OtaRequest request;
  CompletionHandler completion;
};

esp_err_t OtaService::init() {
  if (mutex_ == nullptr) mutex_ = xSemaphoreCreateMutex();
  if (mutex_ == nullptr) return ESP_ERR_NO_MEM;
  const esp_ota_img_states_t unused_state = ESP_OTA_IMG_UNDEFINED;
  (void)unused_state;
  const esp_partition_t* running = esp_ota_get_running_partition();
  esp_ota_img_states_t state = ESP_OTA_IMG_UNDEFINED;
  if (running != nullptr && esp_ota_get_state_partition(running, &state) == ESP_OK &&
      state == ESP_OTA_IMG_PENDING_VERIFY) {
    esp_ota_mark_app_valid_cancel_rollback();
  }
  return ESP_OK;
}

esp_err_t OtaService::request(const OtaRequest& request, CompletionHandler completion) {
  if (request.request_id.empty() || request.artifact_url.empty() ||
      request.target_version.empty() || request.checksum.empty()) return ESP_ERR_INVALID_ARG;
  if (mutex_ == nullptr) return ESP_ERR_INVALID_STATE;

  xSemaphoreTake(mutex_, portMAX_DELAY);
  if (active_) {
    xSemaphoreGive(mutex_);
    return ESP_ERR_INVALID_STATE;
  }
  active_ = true;
  status_ = "queued";
  message_ = request.target_version;
  xSemaphoreGive(mutex_);

  auto* context = new (std::nothrow) TaskContext{this, request, std::move(completion)};
  if (context == nullptr) {
    setState(false, "failed", "out of memory");
    return ESP_ERR_NO_MEM;
  }
  if (xTaskCreate(&OtaService::taskEntry, "schoolbell_ota", 12288, context, 5, nullptr) != pdPASS) {
    delete context;
    setState(false, "failed", "cannot start OTA task");
    return ESP_ERR_NO_MEM;
  }
  return ESP_OK;
}

bool OtaService::active() const {
  if (mutex_ == nullptr) return false;
  xSemaphoreTake(mutex_, portMAX_DELAY);
  const bool value = active_;
  xSemaphoreGive(mutex_);
  return value;
}

std::string OtaService::status() const {
  if (mutex_ == nullptr) return "unavailable";
  xSemaphoreTake(mutex_, portMAX_DELAY);
  const std::string value = status_;
  xSemaphoreGive(mutex_);
  return value;
}

std::string OtaService::message() const {
  if (mutex_ == nullptr) return {};
  xSemaphoreTake(mutex_, portMAX_DELAY);
  const std::string value = message_;
  xSemaphoreGive(mutex_);
  return value;
}

void OtaService::taskEntry(void* opaque) {
  auto* context = static_cast<TaskContext*>(opaque);
  std::string error;
  const esp_err_t result = context->service->perform(context->request, &error);
  const bool success = result == ESP_OK;
  context->service->setState(false, success ? "completed" : "failed",
                             success ? context->request.target_version : error);
  if (context->completion) context->completion(context->request, success, error);
  delete context;
  vTaskDelete(nullptr);
}

void OtaService::setState(bool active, const char* status, const std::string& message) {
  xSemaphoreTake(mutex_, portMAX_DELAY);
  active_ = active;
  status_ = status;
  message_ = message;
  xSemaphoreGive(mutex_);
}

esp_err_t OtaService::perform(const OtaRequest& request, std::string* error_message) {
  auto fail = [&](esp_err_t error, const char* message) {
    if (error_message != nullptr) *error_message = message;
    ESP_LOGE(kTag, "%s: %s", message, esp_err_to_name(error));
    return error;
  };

  std::array<uint8_t, 32> expected_hash{};
  if (!parseSha256(request.checksum, &expected_hash)) {
    return fail(ESP_ERR_INVALID_ARG, "checksum must be SHA-256");
  }
  setState(true, "downloading", request.target_version);

  esp_http_client_config_t http_config = {};
  http_config.url = request.artifact_url.c_str();
  http_config.timeout_ms = 15000;
  http_config.keep_alive_enable = true;
  http_config.crt_bundle_attach = esp_crt_bundle_attach;
  esp_http_client_handle_t http = esp_http_client_init(&http_config);
  if (http == nullptr) return fail(ESP_ERR_NO_MEM, "HTTP client init failed");

  esp_err_t result = esp_http_client_open(http, 0);
  if (result != ESP_OK) {
    esp_http_client_cleanup(http);
    return fail(result, "firmware download open failed");
  }
  const int64_t content_length = esp_http_client_fetch_headers(http);
  const int status_code = esp_http_client_get_status_code(http);
  if (status_code != 200) {
    esp_http_client_close(http);
    esp_http_client_cleanup(http);
    return fail(ESP_FAIL, "firmware server did not return HTTP 200");
  }

  const esp_partition_t* partition = esp_ota_get_next_update_partition(nullptr);
  if (partition == nullptr) {
    esp_http_client_close(http);
    esp_http_client_cleanup(http);
    return fail(ESP_ERR_NOT_FOUND, "no OTA application partition");
  }
  esp_ota_handle_t ota_handle = 0;
  result = esp_ota_begin(partition, content_length > 0 ? static_cast<size_t>(content_length)
                                                       : OTA_SIZE_UNKNOWN,
                         &ota_handle);
  if (result != ESP_OK) {
    esp_http_client_close(http);
    esp_http_client_cleanup(http);
    return fail(result, "OTA partition prepare failed");
  }

  mbedtls_sha256_context sha{};
  mbedtls_sha256_init(&sha);
  mbedtls_sha256_starts(&sha, 0);
  std::array<uint8_t, 4096> buffer{};
  int64_t written = 0;
  while (true) {
    const int count = esp_http_client_read(http, reinterpret_cast<char*>(buffer.data()), buffer.size());
    if (count < 0) {
      result = ESP_FAIL;
      break;
    }
    if (count == 0) break;
    mbedtls_sha256_update(&sha, buffer.data(), static_cast<size_t>(count));
    result = esp_ota_write(ota_handle, buffer.data(), static_cast<size_t>(count));
    if (result != ESP_OK) break;
    written += count;
  }
  esp_http_client_close(http);
  esp_http_client_cleanup(http);

  std::array<uint8_t, 32> actual_hash{};
  mbedtls_sha256_finish(&sha, actual_hash.data());
  mbedtls_sha256_free(&sha);
  if (result != ESP_OK || written == 0 || (content_length > 0 && written != content_length)) {
    esp_ota_abort(ota_handle);
    return fail(result == ESP_OK ? ESP_FAIL : result, "firmware download was incomplete");
  }
  if (actual_hash != expected_hash) {
    esp_ota_abort(ota_handle);
    return fail(ESP_ERR_INVALID_CRC, "firmware SHA-256 mismatch");
  }
  result = esp_ota_end(ota_handle);
  if (result != ESP_OK) return fail(result, "firmware image validation failed");
  result = esp_ota_set_boot_partition(partition);
  if (result != ESP_OK) return fail(result, "cannot select new firmware partition");
  ESP_LOGI(kTag, "OTA image accepted: %s", request.target_version.c_str());
  return ESP_OK;
}

}  // namespace app::services
