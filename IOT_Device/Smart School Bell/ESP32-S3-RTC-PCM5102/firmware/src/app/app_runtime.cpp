#include "app/app_main.h"

#include "app_config.h"
#include "cJSON.h"
#include "esp_err.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

namespace app {

void FirmwareApp::loop() {
  while (true) {
    provisioning_service_.tick();
    wifi_service_.tick();
    cloud_service_.tick(wifi_service_.isConnected());
    enrollment_service_.tick(xTaskGetTickCount() * portTICK_PERIOD_MS, wifi_service_.isConnected());
    sync_service_.tick();
    audio_service_.tick();
    app_state_.setSyncInProgress(sync_service_.inProgress());

    handleButtonEvent(button_driver_.poll());

    const bool announcement_active = audio_service_.announcementActive();
    if (announcement_active != last_announcement_active_) {
      last_announcement_active_ = announcement_active;
      log_service_.info(
          "announcement",
          announcement_active
              ? (audio_service_.softAnnouncementActive() ? "soft_ptt_started" : "physical_ptt_started")
              : "announcement_stopped");
    }
    if (announcement_active && app_state_.snapshot().state != AppState::Playing) {
      app_state_.transition(AppState::Announcing);
    } else if (!announcement_active && app_state_.snapshot().state == AppState::Announcing) {
      app_state_.transition(time_service_.isTimeValid() ? AppState::Ready : AppState::RtcInvalid);
    }

    std::tm now{};
    if (time_service_.getLocalTime(&now) == ESP_OK) {
      app_state_.setTimeValid(true);
      if (app_state_.snapshot().state == AppState::RtcInvalid) app_state_.transition(AppState::Ready);
      if (!holiday_service_.isHoliday(now)) {
        for (const auto& due_schedule : schedule_service_.dueSchedules(now)) {
          RingRequest request;
          request.name = due_schedule.name;
          request.sound_id = due_schedule.sound_id;
          request.duration_seconds = due_schedule.duration_seconds;
          request.trigger_source = "auto";
          handleRingRequest(request);
        }
      }
    } else {
      app_state_.setTimeValid(false);
      const AppState current_state = app_state_.snapshot().state;
      if (current_state != AppState::ErrorFatal && current_state != AppState::Playing &&
          current_state != AppState::Announcing) {
        app_state_.transition(AppState::RtcInvalid, "Clock unavailable");
      }
    }

    applyLedPattern();
    vTaskDelay(pdMS_TO_TICKS(config::kMainLoopIntervalMs));
  }
}

void FirmwareApp::applyLedPattern() {
  if (button_driver_.isPressed()) {
    led_driver_.setPattern(LedPattern::BlinkFactoryResetHold);
    return;
  }
  if (!wifi_service_.hasStationConfig()) {
    led_driver_.setPattern(LedPattern::BlinkProvisioning);
    return;
  }
  if (!wifi_service_.isConnected() || !cloud_service_.configured() ||
      !cloud_service_.connected()) {
    led_driver_.setPattern(LedPattern::AlternateProvisioningIncomplete);
    return;
  }

  const RuntimeSnapshot snapshot = app_state_.snapshot();
  switch (snapshot.state) {
    case AppState::Booting:
      led_driver_.setPattern(LedPattern::HeartbeatBoot);
      break;
    case AppState::RtcInvalid:
      led_driver_.setPattern(LedPattern::BlinkRtcInvalid);
      break;
    case AppState::Syncing:
      led_driver_.setPattern(LedPattern::BlinkSync);
      break;
    case AppState::ErrorFatal:
      led_driver_.setPattern(LedPattern::BlinkFatal);
      break;
    case AppState::Ready:
    case AppState::Playing:
    case AppState::Announcing:
    case AppState::Degraded:
    default:
      led_driver_.setPattern(LedPattern::SolidReady);
      break;
  }
}

void FirmwareApp::handleButtonEvent(ButtonEvent event) {
  if (event == ButtonEvent::ShortPress) {
    RingRequest request;
    request.name = "Manual Test Bell";
    request.sound_id = "default";
    request.duration_seconds = config::kDefaultBellDurationSeconds;
    request.trigger_source = "button";
    handleRingRequest(request);
    return;
  }

  if (event == ButtonEvent::LongPress) {
    // PROVISIONING.md Sections 8a/9/11: wifi_prov_mgr only runs one
    // transport scheme at a time (it's a true Espressif singleton), so
    // BLE-by-default and SoftAP can't both be live simultaneously -- this
    // is the explicit switch-to-SoftAP trigger for whoever can't use BLE
    // (matches this exact button's own long-standing "reserved for future
    // provisioning flow" placeholder). Only meaningful pre-Wi-Fi, same
    // Phase 0 gate as the BLE default in app_main.cpp's bootstrap(); a
    // no-op (ESP_ERR_NOT_SUPPORTED) in the default env.
    if (wifi_service_.hasStationConfig()) {
      log_service_.info("button", "Long press ignored: already provisioned");
      return;
    }
    const esp_err_t prov_err = provisioning_service_.begin(
        services::ProvisioningService::Scheme::SoftAp, "SB", app::config::kProductId,
        [this](const std::string& device_id, const std::string& ip) {
          onProvisioningWifiConnected(device_id, ip);
        },
        web_service_.httpHandle());
    if (prov_err == ESP_OK) {
      log_service_.info("button", "Switched to SoftAP provisioning");
    } else if (prov_err != ESP_ERR_NOT_SUPPORTED) {
      log_service_.warn("button", "Failed to switch to SoftAP provisioning");
    }
    return;
  }

  if (event == ButtonEvent::FactoryReset) {
    log_service_.warn("button", "30-second hold detected; clearing Wi-Fi provisioning");

    // Credentials can originate from the web configuration as well as NVS.
    // Clear the JSON copy first so it cannot repopulate Wi-Fi on the next boot.
    DeviceConfig device_config = config_service_.deviceConfig();
    device_config.wifi.ssid.clear();
    device_config.wifi.password.clear();
    const esp_err_t config_err = config_service_.saveDeviceConfig(device_config);
    if (config_err != ESP_OK) {
      log_service_.error(
          "button",
          (std::string("Factory reset could not clear device config: ") +
           esp_err_to_name(config_err))
              .c_str());
      return;
    }

    const esp_err_t reset_err = wifi_service_.clearStationConfig();
    if (reset_err != ESP_OK) {
      log_service_.error(
          "button", (std::string("Factory reset failed: ") + esp_err_to_name(reset_err)).c_str());
      return;
    }
    log_service_.warn(
        "button", "Factory reset complete; release button to reboot into provisioning");

    led_driver_.setPattern(LedPattern::BlinkFactoryResetComplete);
    while (button_driver_.isPressed()) {
      vTaskDelay(pdMS_TO_TICKS(25));
    }

    esp_restart();
  }
}

void FirmwareApp::onProvisioningWifiConnected(const std::string& device_id, const std::string& ip) {
  log_service_.info(
      "provisioning",
      ("Wi-Fi connected via provisioning, device_id=" + device_id + " ip=" + ip).c_str());

  // wifi_prov_mgr already applied these credentials to the running station
  // config via esp_wifi_set_config(); mirror them into WifiService's own
  // jenix_wifi NVS namespace so hasStationConfig() is true on the next boot
  // instead of re-entering provisioning (see HANDOFF.md's 2026-09-13 entry).
  wifi_config_t current_config = {};
  if (esp_wifi_get_config(WIFI_IF_STA, &current_config) == ESP_OK) {
    const std::string ssid(reinterpret_cast<const char*>(current_config.sta.ssid));
    const std::string password(reinterpret_cast<const char*>(current_config.sta.password));
    const esp_err_t persist_err = wifi_service_.persistStationConfig(ssid, password);
    if (persist_err == ESP_OK) {
      log_service_.info("provisioning", ("Persisted Wi-Fi credentials for ssid=" + ssid).c_str());
    } else {
      log_service_.warn("provisioning", "Failed to persist provisioned Wi-Fi credentials");
    }
  } else {
    log_service_.warn("provisioning", "Could not read applied Wi-Fi config to persist");
  }

  // Fire an enrollment attempt promptly rather than waiting out whatever
  // backoff a previous, unrelated attempt had reached.
  enrollment_service_.onWifiReconnected();
}

esp_err_t FirmwareApp::handleRingRequest(const RingRequest& request) {
  // SD contents can change independently of the persisted manifest. Resolve a
  // /bells request against the live card immediately before playback.
  if (request.sound_id.rfind("bells/", 0) == 0) {
    const esp_err_t refresh_result = config_service_.refreshBellLibrary();
    if (refresh_result != ESP_OK) {
      log_service_.error(
          "ring", request.trigger_source + ":" + request.sound_id + ":library_refresh:" +
                      esp_err_to_name(refresh_result));
      return refresh_result;
    }
    audio_service_.setSoundManifest(config_service_.soundManifest());
  }

  app_state_.transition(AppState::Playing);
  applyLedPattern();

  const esp_err_t err = audio_service_.play(request);
  if (err == ESP_OK) {
    log_service_.info("ring", request.trigger_source + ":" + request.name + ":" + request.sound_id);
    if (audio_service_.announcementActive()) {
      app_state_.transition(AppState::Announcing);
    } else {
      app_state_.transition(time_service_.isTimeValid() ? AppState::Ready : AppState::RtcInvalid);
    }
  } else {
    log_service_.error(
        "ring", request.trigger_source + ":" + request.name + ":" + request.sound_id + ":" +
                    esp_err_to_name(err));
    app_state_.transition(AppState::Degraded, "Playback error");
  }

  applyLedPattern();
  return err;
}

RuntimeSnapshot FirmwareApp::makeSnapshot() const {
  RuntimeSnapshot snapshot = app_state_.snapshot();
  snapshot.sd_ready = storage_service_.sdReady();
  snapshot.wifi_ready = wifi_service_.isReady();
  snapshot.sync_in_progress = sync_service_.inProgress();
  snapshot.time_valid = time_service_.isTimeValid();
  return snapshot;
}

std::string FirmwareApp::makeCloudStatus() const {
  const RuntimeSnapshot snapshot = makeSnapshot();
  cJSON* root = cJSON_CreateObject();
  if (root == nullptr) return "{}";
  cJSON_AddStringToObject(root, "state", toString(snapshot.state));
  cJSON_AddBoolToObject(root, "sd_ready", snapshot.sd_ready);
  cJSON_AddBoolToObject(root, "time_valid", snapshot.time_valid);
  cJSON_AddBoolToObject(root, "automation_enabled", schedule_service_.automationEnabled());
  cJSON_AddBoolToObject(root, "audio_busy", audio_service_.audioBusy());
  cJSON_AddStringToObject(root, "audio_busy_reason", audio_service_.busyReason());
  cJSON_AddBoolToObject(root, "announcement_active", audio_service_.announcementActive());
  cJSON_AddBoolToObject(root, "physical_ptt_pressed", audio_service_.pttPressed());
  std::tm now{};
  if (time_service_.getLocalTime(&now) == ESP_OK) {
    char local_time[32] = {};
    std::strftime(local_time, sizeof(local_time), "%Y-%m-%dT%H:%M:%S", &now);
    cJSON_AddStringToObject(root, "local_time", local_time);
  } else {
    cJSON_AddNullToObject(root, "local_time");
  }
  char* payload = cJSON_PrintUnformatted(root);
  cJSON_Delete(root);
  if (payload == nullptr) return "{}";
  std::string result(payload);
  cJSON_free(payload);
  return result;
}

}  // namespace app
