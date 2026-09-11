#pragma once

#include <mutex>
#include <string>

#include "app_types.h"

namespace app {

class AppStateStore {
 public:
  void transition(AppState next_state, const std::string& detail = {});
  void setTimeValid(bool value);
  void setSdReady(bool value);
  void setWifiReady(bool value);
  void setSyncInProgress(bool value);
  void setIdentity(const std::string& device_id, const std::string& school_name, uint32_t content_version);
  void setLastFault(const std::string& fault_text);
  RuntimeSnapshot snapshot() const;

 private:
  mutable std::mutex mutex_;
  RuntimeSnapshot snapshot_;
};

}  // namespace app
