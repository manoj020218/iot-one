#include "services/cloud_service.h"

#include <algorithm>
#include <cstdio>
#include <cstring>

#include "app_config.h"
#include "cJSON.h"
#include "esp_log.h"
#include "esp_system.h"
#include "nvs.h"

namespace app::services {

namespace {
constexpr char kTag[] = "CloudService";
constexpr char kNvsNamespace[] = "jenix_cloud";
constexpr char kNvsEnabled[] = "enabled";
constexpr char kNvsHomeId[] = "home_id";
constexpr char kNvsHost[] = "mqtt_host";
constexpr char kNvsPort[] = "mqtt_port";
constexpr char kNvsUsername[] = "mqtt_user";
constexpr char kNvsPassword[] = "mqtt_pass";

struct QueuedOtaRequest {
  char request_id[64];
  char artifact_url[384];
  char checksum[80];
  char target_version[40];
};

void copyText(char* destination, size_t capacity, const char* source) {
  if (destination == nullptr || capacity == 0) return;
  std::snprintf(destination, capacity, "%s", source == nullptr ? "" : source);
}

esp_err_t loadString(nvs_handle_t handle, const char* key, std::string* value) {
  size_t size = 0;
  esp_err_t result = nvs_get_str(handle, key, nullptr, &size);
  if (result == ESP_ERR_NVS_NOT_FOUND) return ESP_OK;
  if (result != ESP_OK || size == 0) return result;
  std::string loaded(size, '\0');
  result = nvs_get_str(handle, key, loaded.data(), &size);
  if (result == ESP_OK) {
    loaded.resize(std::strlen(loaded.c_str()));
    *value = std::move(loaded);
  }
  return result;
}

std::string isoUtcNow() {
  const time_t now = time(nullptr);
  std::tm utc{};
  gmtime_r(&now, &utc);
  char text[28] = {};
  std::strftime(text, sizeof(text), "%Y-%m-%dT%H:%M:%SZ", &utc);
  return text;
}
}  // namespace

esp_err_t CloudService::init(const std::string& device_id,
                             StatusProvider status_provider) {
  device_id_ = device_id;
  status_provider_ = std::move(status_provider);
  if (mutex_ == nullptr) mutex_ = xSemaphoreCreateMutex();
  if (ota_queue_ == nullptr) ota_queue_ = xQueueCreate(2, sizeof(QueuedOtaRequest));
  if (mutex_ == nullptr || ota_queue_ == nullptr) return ESP_ERR_NO_MEM;
  ESP_ERROR_CHECK_WITHOUT_ABORT(ota_.init());
  const esp_err_t result = loadConfig();
  rebuildTopics();
  return result;
}

CloudConfig CloudService::config() const {
  if (mutex_ == nullptr) return config_;
  xSemaphoreTake(mutex_, portMAX_DELAY);
  const CloudConfig value = config_;
  xSemaphoreGive(mutex_);
  return value;
}

bool CloudService::configured() const {
  const CloudConfig value = config();
  return value.enabled && !value.home_id.empty() && !value.mqtt_host.empty() &&
         value.mqtt_port > 0 && !value.mqtt_username.empty();
}

esp_err_t CloudService::saveCloudConfig(const CloudConfig& next) {
  if (next.home_id.size() > 64 || next.mqtt_host.empty() || next.mqtt_host.size() > 128 ||
      next.mqtt_port == 0 || next.mqtt_username.size() > 64 || next.mqtt_password.size() > 128) {
    return ESP_ERR_INVALID_ARG;
  }
  xSemaphoreTake(mutex_, portMAX_DELAY);
  config_ = next;
  xSemaphoreGive(mutex_);
  const esp_err_t result = persistConfig();
  if (result == ESP_OK) restart_requested_ = true;
  return result;
}

esp_err_t CloudService::saveDeviceCredential(const std::string& username,
                                             const std::string& password,
                                             bool activate_for_cloud) {
  CloudConfig next = config();
  next.mqtt_username = username;
  next.mqtt_password = password;
  if (activate_for_cloud) next.enabled = true;
  return saveCloudConfig(next);
}

esp_err_t CloudService::loadConfig() {
  CloudConfig loaded;
  loaded.mqtt_host = config::kDefaultMqttHost;
  loaded.mqtt_port = config::kDefaultMqttPort;
  nvs_handle_t handle = 0;
  const esp_err_t open_result = nvs_open(kNvsNamespace, NVS_READONLY, &handle);
  if (open_result == ESP_ERR_NVS_NOT_FOUND) {
    config_ = loaded;
    return ESP_OK;
  }
  if (open_result != ESP_OK) return open_result;
  uint8_t enabled = 0;
  uint16_t port = config::kDefaultMqttPort;
  nvs_get_u8(handle, kNvsEnabled, &enabled);
  nvs_get_u16(handle, kNvsPort, &port);
  loadString(handle, kNvsHomeId, &loaded.home_id);
  loadString(handle, kNvsHost, &loaded.mqtt_host);
  loadString(handle, kNvsUsername, &loaded.mqtt_username);
  loadString(handle, kNvsPassword, &loaded.mqtt_password);
  nvs_close(handle);
  loaded.enabled = enabled != 0;
  loaded.mqtt_port = port;
  config_ = std::move(loaded);
  return ESP_OK;
}

esp_err_t CloudService::persistConfig() const {
  const CloudConfig value = config();
  nvs_handle_t handle = 0;
  esp_err_t result = nvs_open(kNvsNamespace, NVS_READWRITE, &handle);
  if (result != ESP_OK) return result;
  if (result == ESP_OK) result = nvs_set_u8(handle, kNvsEnabled, value.enabled ? 1 : 0);
  if (result == ESP_OK) result = nvs_set_str(handle, kNvsHomeId, value.home_id.c_str());
  if (result == ESP_OK) result = nvs_set_str(handle, kNvsHost, value.mqtt_host.c_str());
  if (result == ESP_OK) result = nvs_set_u16(handle, kNvsPort, value.mqtt_port);
  if (result == ESP_OK) result = nvs_set_str(handle, kNvsUsername, value.mqtt_username.c_str());
  if (result == ESP_OK) result = nvs_set_str(handle, kNvsPassword, value.mqtt_password.c_str());
  if (result == ESP_OK) result = nvs_commit(handle);
  nvs_close(handle);
  return result;
}

void CloudService::rebuildTopics() {
  const CloudConfig value = config();
  const std::string base = "jnx/" + value.home_id + "/" + config::kProductId + "/" + device_id_ + "/";
  status_topic_ = base + "status";
  telemetry_topic_ = base + "telemetry";
  ota_topic_ = base + "ota";
  ota_ack_topic_ = base + "ota/ack";
  lwt_topic_ = base + "lwt";
  mqtt_uri_ = "mqtt://" + value.mqtt_host + ":" + std::to_string(value.mqtt_port);
}

esp_err_t CloudService::startClient() {
  if (!configured()) return ESP_ERR_INVALID_STATE;
  rebuildTopics();
  const CloudConfig value = config();
  static constexpr char kOffline[] = "{\"status\":\"offline\"}";
  esp_mqtt_client_config_t mqtt_config = {};
  mqtt_config.broker.address.uri = mqtt_uri_.c_str();
  mqtt_config.credentials.client_id = device_id_.c_str();
  mqtt_config.credentials.username = value.mqtt_username.c_str();
  mqtt_config.credentials.authentication.password = value.mqtt_password.c_str();
  mqtt_config.session.last_will.topic = lwt_topic_.c_str();
  mqtt_config.session.last_will.msg = kOffline;
  mqtt_config.session.last_will.qos = 1;
  mqtt_config.session.last_will.retain = 1;
  mqtt_config.session.keepalive = 60;
  mqtt_config.network.reconnect_timeout_ms = 5000;
  mqtt_config.buffer.size = 2048;
  client_ = esp_mqtt_client_init(&mqtt_config);
  if (client_ == nullptr) return ESP_ERR_NO_MEM;
  esp_mqtt_client_register_event(client_, static_cast<esp_mqtt_event_id_t>(ESP_EVENT_ANY_ID),
                                 &CloudService::mqttEventHandler, this);
  const esp_err_t result = esp_mqtt_client_start(client_);
  if (result != ESP_OK) stopClient();
  return result;
}

void CloudService::stopClient() {
  connected_ = false;
  if (client_ != nullptr) {
    esp_mqtt_client_stop(client_);
    esp_mqtt_client_destroy(client_);
    client_ = nullptr;
  }
}

void CloudService::tick(bool wifi_connected) {
  wifi_connected_ = wifi_connected;
  if (!wifi_connected_ || !configured()) {
    if (client_ != nullptr) stopClient();
    return;
  }
  if (restart_requested_) {
    restart_requested_ = false;
    stopClient();
  }
  if (client_ == nullptr) startClient();

  QueuedOtaRequest queued{};
  if (!ota_.active() && xQueueReceive(ota_queue_, &queued, 0) == pdTRUE) {
    OtaRequest request;
    request.request_id = queued.request_id;
    request.artifact_url = queued.artifact_url;
    request.checksum = queued.checksum;
    request.target_version = queued.target_version;
    const esp_err_t result = ota_.request(
        request, [this](const OtaRequest& completed, bool success, const std::string& error) {
          publishOtaAck(completed, success, error);
          if (success) {
            vTaskDelay(pdMS_TO_TICKS(config::kOtaRebootDelayMs));
            esp_restart();
          }
        });
    if (result != ESP_OK) publishOtaAck(request, false, "OTA request rejected");
  }

  const uint32_t now = xTaskGetTickCount() * portTICK_PERIOD_MS;
  if (connected_ && (last_status_ms_ == 0 || now - last_status_ms_ >= config::kCloudStatusIntervalMs)) {
    publishStatus();
    last_status_ms_ = now;
  }
}

void CloudService::mqttEventHandler(void* handler_args, esp_event_base_t,
                                    int32_t, void* event_data) {
  auto* self = static_cast<CloudService*>(handler_args);
  if (self != nullptr) self->handleMqttEvent(static_cast<esp_mqtt_event_handle_t>(event_data));
}

void CloudService::handleMqttEvent(esp_mqtt_event_handle_t event) {
  if (event == nullptr) return;
  if (event->event_id == MQTT_EVENT_CONNECTED) {
    connected_ = true;
    esp_mqtt_client_subscribe(client_, ota_topic_.c_str(), 1);
    publishStatus();
    last_status_ms_ = xTaskGetTickCount() * portTICK_PERIOD_MS;
    ESP_LOGI(kTag, "MQTT connected; OTA topic %s", ota_topic_.c_str());
    return;
  }
  if (event->event_id == MQTT_EVENT_DISCONNECTED || event->event_id == MQTT_EVENT_ERROR) {
    connected_ = false;
    return;
  }
  if (event->event_id != MQTT_EVENT_DATA || event->topic == nullptr || event->data == nullptr ||
      event->current_data_offset != 0 || event->data_len != event->total_data_len ||
      event->topic_len != static_cast<int>(ota_topic_.size()) ||
      std::memcmp(event->topic, ota_topic_.data(), ota_topic_.size()) != 0) return;

  cJSON* root = cJSON_ParseWithLength(event->data, static_cast<size_t>(event->data_len));
  if (!cJSON_IsObject(root)) {
    cJSON_Delete(root);
    return;
  }
  const cJSON* request_id = cJSON_GetObjectItemCaseSensitive(root, "requestId");
  const cJSON* device_id = cJSON_GetObjectItemCaseSensitive(root, "deviceId");
  const cJSON* pid = cJSON_GetObjectItemCaseSensitive(root, "pid");
  const cJSON* artifact_url = cJSON_GetObjectItemCaseSensitive(root, "artifactUrl");
  const cJSON* checksum = cJSON_GetObjectItemCaseSensitive(root, "checksum");
  const cJSON* target_version = cJSON_GetObjectItemCaseSensitive(root, "targetVersion");
  const bool valid = cJSON_IsString(request_id) && cJSON_IsString(artifact_url) &&
                     cJSON_IsString(checksum) && cJSON_IsString(target_version) &&
                     (!cJSON_IsString(device_id) || device_id_ == device_id->valuestring) &&
                     (!cJSON_IsString(pid) || std::strcmp(pid->valuestring, config::kProductId) == 0);
  if (valid) {
    QueuedOtaRequest queued{};
    copyText(queued.request_id, sizeof(queued.request_id), request_id->valuestring);
    copyText(queued.artifact_url, sizeof(queued.artifact_url), artifact_url->valuestring);
    copyText(queued.checksum, sizeof(queued.checksum), checksum->valuestring);
    copyText(queued.target_version, sizeof(queued.target_version), target_version->valuestring);
    if (xQueueSend(ota_queue_, &queued, 0) != pdTRUE) {
      OtaRequest rejected{queued.request_id, queued.artifact_url, queued.checksum,
                          queued.target_version};
      publishOtaAck(rejected, false, "OTA queue is busy");
    }
  }
  cJSON_Delete(root);
}

void CloudService::publishStatus() {
  if (!connected_ || client_ == nullptr) return;
  cJSON* root = nullptr;
  if (status_provider_) {
    const std::string supplied = status_provider_();
    root = cJSON_Parse(supplied.c_str());
  }
  if (!cJSON_IsObject(root)) {
    cJSON_Delete(root);
    root = cJSON_CreateObject();
  }
  cJSON_DeleteItemFromObjectCaseSensitive(root, "status");
  cJSON_AddStringToObject(root, "status", "online");
  cJSON_AddStringToObject(root, "deviceId", device_id_.c_str());
  cJSON_AddStringToObject(root, "pid", config::kProductId);
  cJSON_AddStringToObject(root, "firmwareVersion", config::kFirmwareVersion);
  char* payload = cJSON_PrintUnformatted(root);
  cJSON_Delete(root);
  if (payload != nullptr) {
    esp_mqtt_client_publish(client_, status_topic_.c_str(), payload, 0, 1, 1);
    cJSON_free(payload);
  }
}

void CloudService::publishOtaAck(const OtaRequest& request, bool success,
                                 const std::string& error_message) {
  if (!connected_ || client_ == nullptr) return;
  cJSON* root = cJSON_CreateObject();
  cJSON_AddStringToObject(root, "requestId", request.request_id.c_str());
  cJSON_AddStringToObject(root, "deviceId", device_id_.c_str());
  cJSON_AddStringToObject(root, "acknowledgedAt", isoUtcNow().c_str());
  cJSON_AddStringToObject(root, "status", success ? "completed" : "failed");
  if (success) cJSON_AddStringToObject(root, "appliedVersion", request.target_version.c_str());
  else cJSON_AddStringToObject(root, "errorMessage", error_message.c_str());
  char* payload = cJSON_PrintUnformatted(root);
  cJSON_Delete(root);
  if (payload != nullptr) {
    esp_mqtt_client_publish(client_, ota_ack_topic_.c_str(), payload, 0, 1, 0);
    cJSON_free(payload);
  }
}

}  // namespace app::services
