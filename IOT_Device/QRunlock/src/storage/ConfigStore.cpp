#include "storage/ConfigStore.h"

#include <cstdio>
#include <cstring>

#include <esp_system.h>

#include "config/Defaults.h"

namespace storage {
namespace {

constexpr char kDeviceNs[] = "qru_dev";
constexpr char kDeviceKey[] = "device";
constexpr char kWifiNs[] = "qru_wifi";
constexpr char kWifiKey[] = "network";
constexpr char kCloudNs[] = "qru_cloud";
constexpr char kCloudKey[] = "cloud";
constexpr char kLocalAuthNs[] = "qru_auth";
constexpr char kLocalAuthKey[] = "local_auth";
constexpr char kProvisioningNs[] = "qru_prov";
constexpr char kProvisioningKey[] = "prov";

void GenerateHexString(size_t bytes, char* out, size_t outSize) {
  if (outSize < bytes * 2 + 1) {
    if (outSize != 0) out[0] = '\0';
    return;
  }
  for (size_t index = 0; index < bytes; ++index) {
    const uint8_t byte = static_cast<uint8_t>(esp_random() & 0xFF);
    std::snprintf(out + index * 2, outSize - index * 2, "%02X", byte);
  }
}

}  // namespace

bool ConfigStore::Begin() {
  LoadDevice();
  LoadNetwork();
  LoadCloud();
  LoadLocalAuth();
  LoadProvisioning();
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

bool ConfigStore::SaveLocalAuth(const config::LocalAuthConfig& config) {
  const config::LocalAuthConfig next = config::SanitizeLocalAuthConfig(config);
  if (config::LocalAuthConfigEquals(next, localAuthConfig_)) return true;
  Preferences prefs;
  prefs.begin(kLocalAuthNs, false);
  const size_t written = prefs.putBytes(kLocalAuthKey, &next, sizeof(next));
  prefs.end();
  if (written != sizeof(next)) return false;
  localAuthConfig_ = next;
  return true;
}

bool ConfigStore::EnsureLocalApiToken(bool* generated) {
  if (generated != nullptr) *generated = false;
  if (config::kProvisionedLocalApiToken[0] != '\0') {
    if (std::strcmp(localAuthConfig_.apiToken, config::kProvisionedLocalApiToken) == 0 &&
        localAuthConfig_.tokenSource ==
            static_cast<uint8_t>(config::LocalAuthTokenSource::Provisioned)) {
      return true;
    }
    config::LocalAuthConfig next = config::DefaultLocalAuthConfig();
    next.tokenSource = static_cast<uint8_t>(config::LocalAuthTokenSource::Provisioned);
    std::strncpy(next.apiToken, config::kProvisionedLocalApiToken,
                 sizeof(next.apiToken) - 1);
    return SaveLocalAuth(next);
  }
  if (localAuthConfig_.apiToken[0] != '\0') return true;

  config::LocalAuthConfig next = config::DefaultLocalAuthConfig();
  next.tokenSource = static_cast<uint8_t>(config::LocalAuthTokenSource::Generated);
  GenerateHexString(config::kLocalApiTokenBytes, next.apiToken, sizeof(next.apiToken));
  if (generated != nullptr) *generated = true;
  return SaveLocalAuth(next);
}

bool ConfigStore::SaveProvisioning(const config::ProvisioningConfig& config) {
  const config::ProvisioningConfig next = config::SanitizeProvisioningConfig(config);
  if (config::ProvisioningConfigEquals(next, provisioningConfig_)) return true;
  Preferences prefs;
  prefs.begin(kProvisioningNs, false);
  const size_t written = prefs.putBytes(kProvisioningKey, &next, sizeof(next));
  prefs.end();
  if (written != sizeof(next)) return false;
  provisioningConfig_ = next;
  return true;
}

bool ConfigStore::EnsureProvisioningPop(bool* generated) {
  if (generated != nullptr) *generated = false;
  if (config::kProvisionedProofOfPossession[0] != '\0') {
    if (std::strcmp(provisioningConfig_.proofOfPossession,
                    config::kProvisionedProofOfPossession) == 0 &&
        provisioningConfig_.popSource ==
            static_cast<uint8_t>(config::ProvisioningPopSource::Provisioned)) {
      return true;
    }
    config::ProvisioningConfig next = config::DefaultProvisioningConfig();
    next.popSource = static_cast<uint8_t>(config::ProvisioningPopSource::Provisioned);
    std::strncpy(next.proofOfPossession, config::kProvisionedProofOfPossession,
                 sizeof(next.proofOfPossession) - 1);
    return SaveProvisioning(next);
  }
  if (provisioningConfig_.proofOfPossession[0] != '\0') return true;

  config::ProvisioningConfig next = config::DefaultProvisioningConfig();
  next.popSource = static_cast<uint8_t>(config::ProvisioningPopSource::Generated);
  GenerateHexString(config::kProvisioningPopBytes, next.proofOfPossession,
                    sizeof(next.proofOfPossession));
  if (generated != nullptr) *generated = true;
  return SaveProvisioning(next);
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
  prefs.begin(kLocalAuthNs, false);
  prefs.clear();
  prefs.end();
  prefs.begin(kProvisioningNs, false);
  prefs.clear();
  prefs.end();
  deviceConfig_ = config::DefaultDeviceConfig();
  networkConfig_ = config::DefaultNetworkConfig();
  cloudConfig_ = config::DefaultCloudConfig();
  localAuthConfig_ = config::DefaultLocalAuthConfig();
  provisioningConfig_ = config::DefaultProvisioningConfig();
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

void ConfigStore::LoadLocalAuth() {
  localAuthConfig_ = config::DefaultLocalAuthConfig();
  Preferences prefs;
  prefs.begin(kLocalAuthNs, true);
  if (prefs.getBytesLength(kLocalAuthKey) == sizeof(localAuthConfig_)) {
    prefs.getBytes(kLocalAuthKey, &localAuthConfig_, sizeof(localAuthConfig_));
  }
  prefs.end();
  if (localAuthConfig_.schemaVersion != config::kSchemaVersion) {
    localAuthConfig_ = config::DefaultLocalAuthConfig();
    SaveLocalAuth(localAuthConfig_);
  } else {
    localAuthConfig_ = config::SanitizeLocalAuthConfig(localAuthConfig_);
  }
}

void ConfigStore::LoadProvisioning() {
  provisioningConfig_ = config::DefaultProvisioningConfig();
  Preferences prefs;
  prefs.begin(kProvisioningNs, true);
  if (prefs.getBytesLength(kProvisioningKey) == sizeof(provisioningConfig_)) {
    prefs.getBytes(kProvisioningKey, &provisioningConfig_, sizeof(provisioningConfig_));
  }
  prefs.end();
  if (provisioningConfig_.schemaVersion != config::kSchemaVersion) {
    provisioningConfig_ = config::DefaultProvisioningConfig();
    SaveProvisioning(provisioningConfig_);
  } else {
    provisioningConfig_ = config::SanitizeProvisioningConfig(provisioningConfig_);
  }
}

}  // namespace storage
