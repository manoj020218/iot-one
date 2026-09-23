#include "app/app_main.h"

#include "app_config.h"
#include "esp_check.h"
#include "esp_err.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs_flash.h"

namespace app {

namespace {
constexpr char kTag[] = "FirmwareApp";
}

void FirmwareApp::run() {
  esp_log_level_set("*", ESP_LOG_INFO);

  esp_err_t err = nvs_flash_init();
  if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    ESP_ERROR_CHECK(nvs_flash_erase());
    err = nvs_flash_init();
  }
  ESP_ERROR_CHECK(err);

  led_driver_.init();
  button_driver_.init();
  app_state_.transition(AppState::Booting);
  applyLedPattern();

  err = bootstrap();
  if (err != ESP_OK) {
    ESP_LOGE(kTag, "Bootstrap failed: %s", esp_err_to_name(err));
    app_state_.transition(AppState::ErrorFatal, esp_err_to_name(err));
    applyLedPattern();
  }

  loop();
}

esp_err_t FirmwareApp::bootstrap() {
  esp_err_t err = storage_service_.init();
  app_state_.setSdReady(storage_service_.sdReady());
  if (err != ESP_OK) {
    app_state_.setLastFault("Internal flash mount failed");
    ESP_LOGE(kTag, "Internal LittleFS mount failed; persistent configuration unavailable");
  } else if (!storage_service_.sdReady()) {
    ESP_LOGW(kTag, "SD card unavailable; internal-only bell mode active");
  }

  log_service_.init();
  if (storage_service_.isReady()) log_service_.info("boot", storage_service_.sdReady() ? "Internal flash and SD mounted" : "Internal flash mounted; SD optional");

  err = config_service_.load();
  if (err != ESP_OK) {
    log_service_.warn("config", "Falling back to defaults because JSON load failed");
  }

  ESP_RETURN_ON_ERROR(identity_service_.init(), kTag, "device identity failed");
  DeviceConfig device_config = config_service_.deviceConfig();
  if (device_config.device_id != identity_service_.deviceId()) {
    device_config.device_id = identity_service_.deviceId();
    if (config_service_.saveDeviceConfig(device_config) != ESP_OK && storage_service_.isReady()) {
      log_service_.warn("identity", "Stable device ID could not be mirrored to SD");
    }
  }
  app_state_.setIdentity(device_config.device_id, device_config.school_name, device_config.sync.content_version);

  err = time_service_.init(device_config);
  app_state_.setTimeValid(err == ESP_OK && time_service_.isTimeValid());
  if (err != ESP_OK || !time_service_.isTimeValid()) {
    log_service_.warn("rtc", "RTC invalid or unavailable; automatic ringing paused");
    app_state_.transition(AppState::RtcInvalid, "RTC invalid");
  }

  err = audio_service_.init(
      device_config.volume_percent,
      device_config.physical_ptt_enabled,
      device_config.physical_ptt_gain_percent);
  if (err == ESP_OK) {
    audio_service_.setAudioProfiles(config_service_.audioProfiles());
    audio_service_.setSoundManifest(config_service_.soundManifest());
  } else {
    log_service_.warn("audio", "Audio init failed; setup portal remains available");
  }

  err = holiday_service_.load();
  if (err != ESP_OK) {
    log_service_.warn("holidays", "Holiday file unavailable or invalid");
  }

  err = schedule_service_.load();
  if (err != ESP_OK) {
    app_state_.setLastFault("Schedule load failed");
    log_service_.warn("schedule", "Schedule unavailable; setup portal remains available");
  }

  wifi_service_.setMdnsHostname(identity_service_.mdnsHostname());
  err = wifi_service_.init(device_config);
  if (err != ESP_OK) {
    log_service_.warn("wifi", "Wi-Fi init failed; continuing offline");
  }
  app_state_.setWifiReady(wifi_service_.isReady());

  // PROVISIONING.md Section 3 Phase 0: only start provisioning when no
  // station credentials are already stored. Already-provisioned units are
  // completely unaffected by this call. No-op (ESP_ERR_NOT_SUPPORTED) in
  // the default env -- see services::ProvisioningService.
  if (err == ESP_OK && !wifi_service_.hasStationConfig()) {
    const esp_err_t prov_err = provisioning_service_.begin(
        services::ProvisioningService::Scheme::Ble, "SB", app::config::kProductId,
        [this](const std::string& device_id, const std::string& ip) {
          onProvisioningWifiConnected(device_id, ip);
        });
    if (prov_err == ESP_OK) {
      log_service_.info("provisioning", "BLE Security Scheme 2 provisioning started");
    } else if (prov_err != ESP_ERR_NOT_SUPPORTED) {
      log_service_.warn("provisioning", "Failed to start BLE provisioning");
    }
  }

  err = cloud_service_.init(device_config.device_id, [this]() { return makeCloudStatus(); });
  if (err != ESP_OK) log_service_.warn("cloud", "Cloud bridge init failed; local bell remains available");

  err = enrollment_service_.init(device_config.device_id);
  if (err != ESP_OK) {
    log_service_.warn("enrollment", "Cloud enrollment service init failed");
  }

  sync_service_.init();
  app_state_.setSyncInProgress(sync_service_.inProgress());

  err = web_service_.start(
      [this]() { return makeSnapshot(); },
      [this](const RingRequest& request) { return handleRingRequest(request); });
  if (err != ESP_OK) {
    log_service_.warn("web", "Local HTTP service did not start");
  }

  if (time_service_.isTimeValid()) {
    app_state_.transition(AppState::Ready);
  }
  applyLedPattern();
  log_service_.info("boot", "Firmware ready");
  return ESP_OK;
}

}  // namespace app
