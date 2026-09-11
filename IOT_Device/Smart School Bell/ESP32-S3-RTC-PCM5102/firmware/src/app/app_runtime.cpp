#include "app/app_main.h"

#include "app_config.h"
#include "cJSON.h"
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

namespace app {

void FirmwareApp::loop() {
  while (true) {
    led_driver_.tick();
    wifi_service_.tick();
    cloud_service_.tick(wifi_service_.isConnected());
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
    log_service_.info("button", "Long press reserved for future provisioning flow");
    return;
  }

  if (event == ButtonEvent::FactoryReset) {
    log_service_.warn("button", "Factory reset requested but not implemented in scaffold");
  }
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
