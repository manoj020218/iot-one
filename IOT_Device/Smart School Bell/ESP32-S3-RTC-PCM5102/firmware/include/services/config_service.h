#pragma once

#include "app_types.h"
#include "esp_err.h"
#include "services/storage_service.h"

namespace app::services {

class ConfigService {
 public:
  explicit ConfigService(StorageService& storage) : storage_(storage) {}

  esp_err_t load();
  esp_err_t saveDeviceConfig(const DeviceConfig& config);
  esp_err_t registerSoundFile(const std::string& file_name, const std::string& sound_id);
  esp_err_t registerSoundPath(const std::string& file_path, const std::string& sound_id);
  esp_err_t unregisterSoundFile(const std::string& sound_id);
  esp_err_t refreshBellLibrary();
  const DeviceConfig& deviceConfig() const { return device_config_; }
  const SoundManifest& soundManifest() const { return sound_manifest_; }
  const AudioProfileMap& audioProfiles() const { return audio_profiles_; }
  const SoundAsset* resolveSound(const std::string& sound_id) const;

 private:
  void loadDefaultAudioProfiles();
  void loadDefaultManifest();
  esp_err_t saveSoundManifest() const;
  void discoverBellDirectory(const std::string& directory,
                             const std::string& relative_path,
                             size_t depth);

  StorageService& storage_;
  DeviceConfig device_config_;
  AudioProfileMap audio_profiles_;
  SoundManifest sound_manifest_;
};

}  // namespace app::services
