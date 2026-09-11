#pragma once

#include "app_state.h"
#include "drivers/button_driver.h"
#include "drivers/led_driver.h"
#include "drivers/internal_flash_driver.h"
#include "drivers/pcm5102_i2s.h"
#include "drivers/rtc_driver.h"
#include "drivers/sd_driver.h"
#include "services/audio_service.h"
#include "services/config_service.h"
#include "services/cloud_service.h"
#include "services/device_identity_service.h"
#include "services/holiday_service.h"
#include "services/log_service.h"
#include "services/ota_service.h"
#include "services/provisioning_service.h"
#include "services/schedule_service.h"
#include "services/storage_service.h"
#include "services/sync_service.h"
#include "services/time_service.h"
#include "services/web_service.h"
#include "services/wifi_service.h"

namespace app {

class FirmwareApp {
 public:
  void run();

 private:
  esp_err_t bootstrap();
  void loop();
  void applyLedPattern();
  void handleButtonEvent(ButtonEvent event);
  esp_err_t handleRingRequest(const RingRequest& request);
  RuntimeSnapshot makeSnapshot() const;
  std::string makeCloudStatus() const;

  AppStateStore app_state_;
  drivers::LedDriver led_driver_;
  drivers::ButtonDriver button_driver_;
  drivers::RtcDriver rtc_driver_;
  drivers::InternalFlashDriver internal_flash_driver_;
  drivers::SdDriver sd_driver_;
  drivers::Pcm5102I2s pcm5102_driver_;

  services::StorageService storage_service_{internal_flash_driver_, sd_driver_};
  services::LogService log_service_{storage_service_};
  services::ConfigService config_service_{storage_service_};
  services::DeviceIdentityService identity_service_;
  services::HolidayService holiday_service_{storage_service_};
  services::ScheduleService schedule_service_{storage_service_};
  services::TimeService time_service_{rtc_driver_};
  services::AudioService audio_service_{storage_service_, pcm5102_driver_};
  services::WifiService wifi_service_;
  services::ProvisioningService provisioning_service_;
  services::OtaService ota_service_;
  services::CloudService cloud_service_{ota_service_};
  services::SyncService sync_service_{log_service_};
  services::WebService web_service_{
      storage_service_, config_service_, schedule_service_, holiday_service_, log_service_, time_service_, wifi_service_, audio_service_, cloud_service_};
  bool last_announcement_active_ = false;
};

}  // namespace app
