#pragma once

#include <atomic>
#include <functional>
#include <string>

#include "app_types.h"
#include "esp_err.h"
#include "esp_http_server.h"

namespace app::services {

class AudioService;
class CloudService;
class ConfigService;
class HolidayService;
class LogService;
class ScheduleService;
class StorageService;
class TimeService;
class WifiService;

class WebService {
 public:
  using SnapshotProvider = std::function<RuntimeSnapshot()>;
  using RingHandler = std::function<esp_err_t(const RingRequest&)>;

  WebService(
      StorageService& storage,
      ConfigService& config,
      ScheduleService& schedules,
      HolidayService& holidays,
      LogService& logs,
      TimeService& time,
      WifiService& wifi,
      AudioService& audio,
      CloudService& cloud)
      : storage_(storage), config_(config), schedules_(schedules), holidays_(holidays), logs_(logs), time_(time), wifi_(wifi), audio_(audio), cloud_(cloud) {}

  esp_err_t start(SnapshotProvider snapshot_provider, RingHandler ring_handler);
  void stop();
  // For sharing this server with wifi_prov_scheme_softap_set_httpd_handle()
  // instead of it starting a second one (see ProvisioningService::begin()).
  // Null until start() has run.
  httpd_handle_t httpHandle() const { return server_; }

 private:
  static esp_err_t handleUi(httpd_req_t* req);
  static esp_err_t handleApi(httpd_req_t* req);
  static esp_err_t handleLegacyStatus(httpd_req_t* req);
  static esp_err_t handleLegacyRing(httpd_req_t* req);
  static esp_err_t handleAnnouncementWebSocket(httpd_req_t* req);
  esp_err_t dispatchApi(httpd_req_t* req);
  esp_err_t renderStatus(httpd_req_t* req);
  esp_err_t renderCapabilities(httpd_req_t* req);
  esp_err_t renderConfig(httpd_req_t* req);
  esp_err_t updateConfig(httpd_req_t* req);
  esp_err_t renderAnnouncementStatus(httpd_req_t* req);
  esp_err_t renderCloud(httpd_req_t* req);
  esp_err_t updateCloud(httpd_req_t* req);
  esp_err_t updateDeviceMqttCredential(httpd_req_t* req);
  esp_err_t renderSchedules(httpd_req_t* req);
  esp_err_t updateSchedules(httpd_req_t* req);
  esp_err_t renderScheduleProfiles(httpd_req_t* req);
  esp_err_t updateScheduleProfiles(httpd_req_t* req);
  esp_err_t setActiveProfile(httpd_req_t* req);
  esp_err_t setAutomation(httpd_req_t* req);
  esp_err_t renderHolidays(httpd_req_t* req);
  esp_err_t updateHolidays(httpd_req_t* req);
  esp_err_t renderPresets(httpd_req_t* req);
  esp_err_t updatePresets(httpd_req_t* req);
  esp_err_t renderLogs(httpd_req_t* req);
  esp_err_t clearLogs(httpd_req_t* req);
  esp_err_t renderSounds(httpd_req_t* req);
  esp_err_t browseBellFolder(httpd_req_t* req);
  esp_err_t streamSound(httpd_req_t* req);
  esp_err_t deleteSound(httpd_req_t* req);
  esp_err_t processRing(httpd_req_t* req);
  esp_err_t playDiagnosticTone(httpd_req_t* req);
  esp_err_t updateTime(httpd_req_t* req);
  esp_err_t formatSd(httpd_req_t* req);
  esp_err_t uploadSound(httpd_req_t* req);
  esp_err_t renderFestival(httpd_req_t* req);
  esp_err_t uploadFestival(httpd_req_t* req);
  esp_err_t streamFestival(httpd_req_t* req);
  esp_err_t clearFestival(httpd_req_t* req);

  StorageService& storage_;
  ConfigService& config_;
  ScheduleService& schedules_;
  HolidayService& holidays_;
  LogService& logs_;
  TimeService& time_;
  WifiService& wifi_;
  AudioService& audio_;
  CloudService& cloud_;
  httpd_handle_t server_ = nullptr;
  std::atomic<int> soft_ptt_socket_{-1};
  SnapshotProvider snapshot_provider_;
  RingHandler ring_handler_;
};

}  // namespace app::services
