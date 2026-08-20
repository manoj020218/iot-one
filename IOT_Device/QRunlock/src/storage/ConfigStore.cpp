#include "storage/ConfigStore.h"

#include <cstring>

#include "config/Defaults.h"

namespace storage {
namespace {

constexpr char kDeviceNs[] = "qru_dev";
constexpr char kDeviceKey[] = "device";
constexpr char kWifiNs[] = "qru_wifi";
constexpr char kWifiKey[] = "network";
constexpr char kCloudNs[] = "qru_cloud";
constexpr char kCloudKey[] = "cloud";

}  // namespace

bool ConfigStore::Begin() {
  LoadDevice();
  LoadNetwork();
  LoadCloud();
  return true;
}

bool ConfigStore::SaveDevice(const config::DeviceConfig& config) {
  const config::DeviceConfig next = config::SanitizeDeviceConfig(config);
  if (config::DeviceConfigEquals(next, deviceConfig_)) return true;
  Preferences prefs;
  prefs.begin(kDeviceNs, false);
  const size_t written = prefs.putBytes(kDeviceKey, &next, sizeof(next));
  prefs.end();
  if (written != sizeof(next)) return false;
  deviceConfig_ = next;
  return true;
}

bool ConfigStore::SaveNetwork(const String& ssid, const String& password) {
  config::NetworkConfig next = config::DefaultNetworkConfig();
  next.configured = ssid.isEmpty() ? 0 : 1;
  std::strncpy(next.ssid, ssid.c_str(), sizeof(next.ssid) - 1);
  std::strncpy(next.password, password.c_str(), sizeof(next.password) - 1);
  if (config::NetworkConfigEquals(next, networkConfig_)) return true;
  Preferences prefs;
  prefs.begin(kWifiNs, false);
  const size_t written = prefs.putBytes(kWifiKey, &next, sizeof(next));
  prefs.end();
  if (written != sizeof(next)) return false;
  networkConfig_ = next;
  return true;
}

bool ConfigStore::SaveCloud(const config::CloudConfig& config) {
  const config::CloudConfig next = config::SanitizeCloudConfig(config);
  if (config::CloudConfigEquals(next, cloudConfig_)) return true;
  Preferences prefs;
  prefs.begin(kCloudNs, false);
  const size_t written = prefs.putBytes(kCloudKey, &next, sizeof(next));
  prefs.end();
  if (written != sizeof(next)) return false;
  cloudConfig_ = next;
  return true;
}

void ConfigStore::FactoryReset() {
  Preferences prefs;
  prefs.begin(kDeviceNs, false);
  prefs.clear();
  prefs.end();
  prefs.begin(kWifiNs, false);
  prefs.clear();
  prefs.end();
  prefs.begin(kCloudNs, false);
  prefs.clear();
  prefs.end();
  deviceConfig_ = config::DefaultDeviceConfig();
  networkConfig_ = config::DefaultNetworkConfig();
  cloudConfig_ = config::DefaultCloudConfig();
}

void ConfigStore::LoadDevice() {
  deviceConfig_ = config::DefaultDeviceConfig();
  Preferences prefs;
  prefs.begin(kDeviceNs, true);
  if (prefs.getBytesLength(kDeviceKey) == sizeof(deviceConfig_)) {
    prefs.getBytes(kDeviceKey, &deviceConfig_, sizeof(deviceConfig_));
  }
  prefs.end();
  if (deviceConfig_.schemaVersion != config::kSchemaVersion) {
    deviceConfig_ = config::DefaultDeviceConfig();
    SaveDevice(deviceConfig_);
  } else {
    deviceConfig_ = config::SanitizeDeviceConfig(deviceConfig_);
  }
}

void ConfigStore::LoadNetwork() {
  networkConfig_ = config::DefaultNetworkConfig();
  Preferences prefs;
  prefs.begin(kWifiNs, true);
  if (prefs.getBytesLength(kWifiKey) == sizeof(networkConfig_)) {
    prefs.getBytes(kWifiKey, &networkConfig_, sizeof(networkConfig_));
  }
  prefs.end();
}

void ConfigStore::LoadCloud() {
  cloudConfig_ = config::DefaultCloudConfig();
  Preferences prefs;
  prefs.begin(kCloudNs, true);
  if (prefs.getBytesLength(kCloudKey) == sizeof(cloudConfig_)) {
    prefs.getBytes(kCloudKey, &cloudConfig_, sizeof(cloudConfig_));
  }
  prefs.end();
  if (cloudConfig_.schemaVersion != config::kSchemaVersion) {
    cloudConfig_ = config::DefaultCloudConfig();
    SaveCloud(cloudConfig_);
  } else {
    cloudConfig_ = config::SanitizeCloudConfig(cloudConfig_);
  }
}

}  // namespace storage
