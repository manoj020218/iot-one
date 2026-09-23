#include "services/cloud_enrollment_service.h"

#include <algorithm>
#include <array>
#include <cstdlib>

#include "app_config.h"
#include "cJSON.h"
#include "esp_crt_bundle.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

namespace app::services {

namespace {
constexpr char kTag[] = "CloudEnrollment";
constexpr int kHttpTimeoutMs = 10000;
constexpr size_t kMaxResponseBytes = 2048;

// ±20% jitter so a Wi-Fi outage recovering for many devices at once
// doesn't thundering-herd the backend with synchronized retries.
uint32_t withJitter(uint32_t backoff_ms) {
  const int32_t jitter_range = static_cast<int32_t>(backoff_ms) / 5;  // 20%
  const int32_t jitter = jitter_range > 0 ? (std::rand() % (2 * jitter_range)) - jitter_range : 0;
  return static_cast<uint32_t>(static_cast<int32_t>(backoff_ms) + jitter);
}
}  // namespace

struct CloudEnrollmentService::TaskContext {
  CloudEnrollmentService* service = nullptr;
};

esp_err_t CloudEnrollmentService::init(std::string device_id) {
  device_id_ = std::move(device_id);
  // Nothing else to allocate up front -- fetches run on a short-lived task
  // spawned per attempt (see performFetch()/taskEntry()).
  return ESP_OK;
}

void CloudEnrollmentService::onWifiReconnected() {
  backoff_ms_ = 0;
  last_attempt_ms_ = 0;
}

void CloudEnrollmentService::tick(uint32_t now_ms, bool wifi_connected) {
  if (!wifi_connected || cloud_.configured() || fetch_in_flight_) return;
  if (now_ms - last_attempt_ms_ < backoff_ms_) return;

  auto* context = new (std::nothrow) TaskContext{this};
  if (context == nullptr) return;

  fetch_in_flight_ = true;
  last_attempt_ms_ = now_ms;
  if (xTaskCreate(&CloudEnrollmentService::taskEntry, "cloud_enroll", 8192, context, 4,
                   nullptr) != pdPASS) {
    delete context;
    fetch_in_flight_ = false;
  }
}

void CloudEnrollmentService::taskEntry(void* opaque) {
  auto* context = static_cast<TaskContext*>(opaque);
  context->service->performFetch();
  delete context;
  vTaskDelete(nullptr);
}

void CloudEnrollmentService::performFetch() {
  const std::string url =
      std::string(config::kBackendBaseUrl) + "/v1/devices/" + device_id_ + "/enrollment";

  esp_http_client_config_t http_config = {};
  http_config.url = url.c_str();
  http_config.method = HTTP_METHOD_POST;
  http_config.timeout_ms = kHttpTimeoutMs;
  http_config.crt_bundle_attach = esp_crt_bundle_attach;
  esp_http_client_handle_t http = esp_http_client_init(&http_config);

  bool success = false;
  if (http != nullptr) {
    esp_http_client_set_header(http, "Content-Type", "application/json");
    // POST with an explicit zero-length body -- the backend reads deviceId
    // from the URL, not the request body.
    if (esp_http_client_open(http, 0) == ESP_OK) {
      const int64_t content_length = esp_http_client_fetch_headers(http);
      const int status_code = esp_http_client_get_status_code(http);

      if (status_code == 200 && content_length > 0 &&
          static_cast<size_t>(content_length) < kMaxResponseBytes) {
        std::array<char, kMaxResponseBytes> buffer{};
        int total_read = 0;
        while (total_read < content_length) {
          const int count = esp_http_client_read(
              http, buffer.data() + total_read, buffer.size() - 1 - total_read);
          if (count <= 0) break;
          total_read += count;
        }
        buffer[total_read] = '\0';

        cJSON* root = cJSON_Parse(buffer.data());
        if (cJSON_IsObject(root)) {
          const cJSON* data = cJSON_GetObjectItemCaseSensitive(root, "data");
          const cJSON* home_id = cJSON_GetObjectItemCaseSensitive(data, "homeId");
          const cJSON* mqtt_host = cJSON_GetObjectItemCaseSensitive(data, "mqttHost");
          const cJSON* mqtt_port = cJSON_GetObjectItemCaseSensitive(data, "mqttPort");
          const cJSON* mqtt_username = cJSON_GetObjectItemCaseSensitive(data, "mqttUsername");
          const cJSON* mqtt_password = cJSON_GetObjectItemCaseSensitive(data, "mqttPassword");

          if (cJSON_IsString(home_id) && cJSON_IsString(mqtt_host) && cJSON_IsNumber(mqtt_port) &&
              cJSON_IsString(mqtt_username) && cJSON_IsString(mqtt_password)) {
            CloudConfig config = cloud_.config();
            config.enabled = true;
            config.home_id = home_id->valuestring;
            config.mqtt_host = mqtt_host->valuestring;
            config.mqtt_port = static_cast<uint16_t>(mqtt_port->valuedouble);

            if (cloud_.saveCloudConfig(config) == ESP_OK &&
                cloud_.saveDeviceCredential(mqtt_username->valuestring,
                                            mqtt_password->valuestring,
                                            /*activate_for_cloud=*/true) == ESP_OK) {
              success = true;
              ESP_LOGI(kTag, "Enrollment succeeded, home_id=%s mqtt_host=%s",
                       config.home_id.c_str(), config.mqtt_host.c_str());
            } else {
              ESP_LOGW(kTag, "Enrollment response applied but failed to persist");
            }
          } else {
            ESP_LOGW(kTag, "Enrollment response missing expected fields");
          }
        } else {
          ESP_LOGW(kTag, "Enrollment response was not valid JSON");
        }
        cJSON_Delete(root);
      } else if (status_code == 404) {
        // Expected, normal case: the phone app hasn't finished registering
        // this device with the backend yet. Not an error -- just retry.
        ESP_LOGI(kTag, "Device not registered with backend yet, will retry");
      } else {
        ESP_LOGW(kTag, "Enrollment request failed, status=%d", status_code);
      }
    } else {
      ESP_LOGW(kTag, "Enrollment request could not open connection");
    }
    esp_http_client_close(http);
    esp_http_client_cleanup(http);
  } else {
    ESP_LOGW(kTag, "Enrollment HTTP client init failed");
  }

  if (success) {
    backoff_ms_ = 0;
  } else {
    backoff_ms_ = withJitter(backoff_ms_ == 0 ? config::kEnrollmentInitialBackoffMs
                                              : std::min(backoff_ms_ * 2,
                                                         config::kEnrollmentMaxBackoffMs));
  }
  fetch_in_flight_ = false;
}

}  // namespace app::services
