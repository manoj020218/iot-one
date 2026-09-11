#include "app_state.h"

namespace app {

void AppStateStore::transition(AppState next_state, const std::string& detail) {
  std::lock_guard<std::mutex> lock(mutex_);
  snapshot_.state = next_state;
  if (!detail.empty()) {
    snapshot_.last_fault = detail;
  }
}

void AppStateStore::setTimeValid(bool value) {
  std::lock_guard<std::mutex> lock(mutex_);
  snapshot_.time_valid = value;
}

void AppStateStore::setSdReady(bool value) {
  std::lock_guard<std::mutex> lock(mutex_);
  snapshot_.sd_ready = value;
}

void AppStateStore::setWifiReady(bool value) {
  std::lock_guard<std::mutex> lock(mutex_);
  snapshot_.wifi_ready = value;
}

void AppStateStore::setSyncInProgress(bool value) {
  std::lock_guard<std::mutex> lock(mutex_);
  snapshot_.sync_in_progress = value;
}

void AppStateStore::setIdentity(const std::string& device_id, const std::string& school_name, uint32_t content_version) {
  std::lock_guard<std::mutex> lock(mutex_);
  snapshot_.device_id = device_id;
  snapshot_.school_name = school_name;
  snapshot_.content_version = content_version;
}

void AppStateStore::setLastFault(const std::string& fault_text) {
  std::lock_guard<std::mutex> lock(mutex_);
  snapshot_.last_fault = fault_text;
}

RuntimeSnapshot AppStateStore::snapshot() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return snapshot_;
}

}  // namespace app
