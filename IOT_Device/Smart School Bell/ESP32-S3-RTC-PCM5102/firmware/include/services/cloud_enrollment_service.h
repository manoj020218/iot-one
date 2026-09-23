#pragma once

#include <cstdint>
#include <string>

#include "services/cloud_service.h"

namespace app::services {

// Fetches this device's home_id + MQTT broker connection details from the
// backend once Wi-Fi is up, and applies them via CloudService's existing
// saveCloudConfig()/saveDeviceCredential() setters -- closes the gap where
// a fully-provisioned, Wi-Fi-connected device never had anything push real
// cloud config onto it, so it never attempted an MQTT connection and never
// showed "online". See NEW_PRODUCT_LAUNCH_SOP.md-adjacent HANDOFF entry for
// the platform-side half (POST /api/v1/devices/:deviceId/enrollment).
//
// Deliberately does not modify CloudService itself -- its public setters
// are the entire integration surface this class needs.
class CloudEnrollmentService {
 public:
  explicit CloudEnrollmentService(CloudService& cloud) : cloud_(cloud) {}

  // device_id must be the real, resolved device ID -- called from
  // bootstrap() after identity_service_.init() has run, matching
  // CloudService::init()'s own (device_id, ...) parameter convention.
  // Deliberately not captured at construction time: DeviceIdentityService
  // hasn't resolved a real device ID yet when FirmwareApp's members are
  // constructed, only once its own init() runs later in bootstrap().
  esp_err_t init(std::string device_id);
  // now_ms: a monotonic millisecond clock (xTaskGetTickCount() * portTICK_PERIOD_MS
  // is fine -- only used for backoff timing, not wall-clock correctness).
  void tick(uint32_t now_ms, bool wifi_connected);
  // Resets backoff to fire promptly on the next tick() -- called right
  // after Wi-Fi connects via provisioning, so enrollment doesn't wait out
  // whatever backoff a previous, unrelated attempt had reached.
  void onWifiReconnected();

 private:
  struct TaskContext;
  static void taskEntry(void* context);
  // Runs on its own task -- blocking HTTPS call, must never run on the main
  // loop's task (would stall bell scheduling/audio/button polling for the
  // duration of DNS+TLS+HTTP, same reasoning as OtaService's own task).
  void performFetch();

  CloudService& cloud_;
  std::string device_id_;
  volatile bool fetch_in_flight_ = false;
  uint32_t last_attempt_ms_ = 0;
  // Written from both the main-loop task (onWifiReconnected()) and the
  // short-lived fetch task (performFetch()) -- fetch_in_flight_ already
  // guarantees only one of those can be touching it at a time, but volatile
  // keeps this honest against compiler reordering across that boundary.
  volatile uint32_t backoff_ms_ = 0;
};

}  // namespace app::services
