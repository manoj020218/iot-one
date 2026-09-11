#pragma once

#include <functional>
#include <string>

#include "app_types.h"
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "mqtt_client.h"
#include "services/ota_service.h"

namespace app::services {

class CloudService {
 public:
  using StatusProvider = std::function<std::string()>;

  explicit CloudService(OtaService& ota) : ota_(ota) {}

  esp_err_t init(const std::string& device_id, StatusProvider status_provider);
  void tick(bool wifi_connected);
  CloudConfig config() const;
  esp_err_t saveCloudConfig(const CloudConfig& config);
  esp_err_t saveDeviceCredential(const std::string& username,
                                 const std::string& password,
                                 bool activate_for_cloud);
  bool configured() const;
  bool connected() const { return connected_; }
  const std::string& statusTopic() const { return status_topic_; }
  const std::string& otaTopic() const { return ota_topic_; }
  OtaService& ota() { return ota_; }

 private:
  static void mqttEventHandler(void* handler_args, esp_event_base_t base,
                               int32_t event_id, void* event_data);
  void handleMqttEvent(esp_mqtt_event_handle_t event);
  void rebuildTopics();
  esp_err_t startClient();
  void stopClient();
  void publishStatus();
  void publishOtaAck(const OtaRequest& request, bool success,
                     const std::string& error_message);
  esp_err_t loadConfig();
  esp_err_t persistConfig() const;

  OtaService& ota_;
  mutable SemaphoreHandle_t mutex_ = nullptr;
  QueueHandle_t ota_queue_ = nullptr;
  esp_mqtt_client_handle_t client_ = nullptr;
  CloudConfig config_;
  std::string device_id_;
  std::string mqtt_uri_;
  std::string status_topic_;
  std::string telemetry_topic_;
  std::string ota_topic_;
  std::string ota_ack_topic_;
  std::string lwt_topic_;
  StatusProvider status_provider_;
  volatile bool connected_ = false;
  volatile bool restart_requested_ = false;
  bool wifi_connected_ = false;
  uint32_t last_status_ms_ = 0;
};

}  // namespace app::services
