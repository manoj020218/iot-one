#pragma once

#include <Arduino.h>
#include <Preferences.h>

#include "config/ConfigTypes.h"

namespace storage {

class ConfigStore {
 public:
  bool Begin();

  const config::DeviceConfig& Device() const { return deviceConfig_; }
  const config::NetworkConfig& Network() const { return networkConfig_; }
  const config::CloudConfig& Cloud() const { return cloudConfig_; }
  const config::MqttDeviceCredentialConfig& DeviceMqttCredential() const {
    return deviceMqttCredentialConfig_;
  }
  const config::LocalAuthConfig& LocalAuth() const { return localAuthConfig_; }
  const config::ProvisioningConfig& Provisioning() const {
    return provisioningConfig_;
  }

  bool SaveDevice(const config::DeviceConfig& config);
  bool SaveNetwork(const String& ssid, const String& password);
  bool SaveCloud(const config::CloudConfig& config);
  bool SaveDeviceMqttCredential(const config::MqttDeviceCredentialConfig& config);
  bool EnsureDeviceMqttCredential(bool* provisioned = nullptr);
  bool SaveLocalAuth(const config::LocalAuthConfig& config);
  bool EnsureLocalApiToken(bool* generated = nullptr);
  bool SaveProvisioning(const config::ProvisioningConfig& config);
  bool EnsureProvisioningPop(bool* generated = nullptr);
  void FactoryReset();

 private:
  void LoadDevice();
  void LoadNetwork();
  void LoadCloud();
  void LoadDeviceMqttCredential();
  void LoadLocalAuth();
  void LoadProvisioning();

  config::DeviceConfig deviceConfig_{};
  config::NetworkConfig networkConfig_{};
  config::CloudConfig cloudConfig_{};
  config::MqttDeviceCredentialConfig deviceMqttCredentialConfig_{};
  config::LocalAuthConfig localAuthConfig_{};
  config::ProvisioningConfig provisioningConfig_{};
};

}  // namespace storage
