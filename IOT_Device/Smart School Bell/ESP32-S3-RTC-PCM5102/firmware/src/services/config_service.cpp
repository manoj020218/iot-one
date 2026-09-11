#include "services/config_service.h"

#include <algorithm>
#include <cctype>
#include <cstring>
#include <dirent.h>
#include <sys/stat.h>

#include "app_config.h"
#include "cJSON.h"
#include "esp_log.h"
#include "utils/json_utils.h"

namespace app::services {

namespace {
constexpr char kTag[] = "ConfigService";

void loadAudioProfileFromJson(const cJSON* root, AudioProfile* profile) {
  if (root == nullptr || profile == nullptr) return;

  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "name"); cJSON_IsString(item)) profile->name = item->valuestring;
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "source"); cJSON_IsString(item)) profile->source_type = item->valuestring;
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "transport"); cJSON_IsString(item)) profile->transport = item->valuestring;
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "format"); cJSON_IsString(item)) profile->format = item->valuestring;
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "endpoint"); cJSON_IsString(item)) profile->endpoint = item->valuestring;
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "enabled"); cJSON_IsBool(item)) profile->enabled = cJSON_IsTrue(item);
}

void loadSoundAssetFromJson(const cJSON* root, SoundAsset* sound_asset) {
  if (root == nullptr || sound_asset == nullptr) return;

  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "profile"); cJSON_IsString(item)) sound_asset->profile_id = item->valuestring;
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "file"); cJSON_IsString(item)) sound_asset->file_path = item->valuestring;
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "url"); cJSON_IsString(item)) sound_asset->stream_url = item->valuestring;
  if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "duration"); cJSON_IsNumber(item)) {
    sound_asset->duration_seconds = static_cast<uint32_t>(
        std::clamp(item->valuedouble, 0.0, static_cast<double>(app::config::kMaxBellDurationSeconds)));
  }
}
}

esp_err_t ConfigService::load() {
  std::string raw_device_config;
  if (storage_.readText(app::config::kDeviceConfigPath, &raw_device_config) == ESP_OK) {
    cJSON* root = utils::parseJson(raw_device_config);
    if (root != nullptr) {
      if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "device_id"); cJSON_IsString(item)) device_config_.device_id = item->valuestring;
      if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "school_name"); cJSON_IsString(item)) device_config_.school_name = item->valuestring;
      if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "timezone"); cJSON_IsString(item)) device_config_.timezone = item->valuestring;
      if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "timezone_posix"); cJSON_IsString(item)) device_config_.timezone_posix = item->valuestring;
      if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(root, "volume_percent"); cJSON_IsNumber(item)) {
        device_config_.volume_percent = static_cast<uint8_t>(std::clamp(item->valuedouble, 0.0, 100.0));
      }
      if (const cJSON* announcement = cJSON_GetObjectItemCaseSensitive(root, "announcement"); cJSON_IsObject(announcement)) {
        if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(announcement, "physical_ptt_enabled"); cJSON_IsBool(item)) {
          device_config_.physical_ptt_enabled = cJSON_IsTrue(item);
        }
        if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(announcement, "mic_gain_percent"); cJSON_IsNumber(item)) {
          device_config_.physical_ptt_gain_percent = static_cast<uint16_t>(std::clamp(
              item->valuedouble,
              25.0,
              static_cast<double>(app::config::kAnnouncementMaxGainPercent)));
        }
      }

      if (const cJSON* wifi = cJSON_GetObjectItemCaseSensitive(root, "wifi"); cJSON_IsObject(wifi)) {
        if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(wifi, "mode"); cJSON_IsString(item)) device_config_.wifi.mode = item->valuestring;
        if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(wifi, "ssid"); cJSON_IsString(item)) device_config_.wifi.ssid = item->valuestring;
        if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(wifi, "password"); cJSON_IsString(item)) device_config_.wifi.password = item->valuestring;
      }

      if (const cJSON* sync = cJSON_GetObjectItemCaseSensitive(root, "sync"); cJSON_IsObject(sync)) {
        if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(sync, "source"); cJSON_IsString(item)) device_config_.sync.source = item->valuestring;
        if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(sync, "last_sync_utc"); cJSON_IsString(item)) device_config_.sync.last_sync_utc = item->valuestring;
        if (const cJSON* item = cJSON_GetObjectItemCaseSensitive(sync, "content_version"); cJSON_IsNumber(item)) device_config_.sync.content_version = static_cast<uint32_t>(item->valuedouble);
      }
      cJSON_Delete(root);
    }
  } else {
    ESP_LOGW(kTag, "device.json not found, defaults remain active");
  }

  loadDefaultAudioProfiles();
  sound_manifest_.clear();
  std::string raw_manifest;
  if (storage_.readText(app::config::kSoundsManifestPath, &raw_manifest) == ESP_OK) {
    cJSON* root = utils::parseJson(raw_manifest);
    if (root != nullptr) {
      if (const cJSON* profiles = cJSON_GetObjectItemCaseSensitive(root, "profiles"); cJSON_IsObject(profiles)) {
        const cJSON* profile = nullptr;
        cJSON_ArrayForEach(profile, profiles) {
          if (!cJSON_IsObject(profile) || profile->string == nullptr) continue;
          AudioProfile audio_profile;
          audio_profile.profile_id = profile->string;
          loadAudioProfileFromJson(profile, &audio_profile);
          audio_profiles_[audio_profile.profile_id] = audio_profile;
        }
        if (audio_profiles_.empty()) loadDefaultAudioProfiles();
      }

      const cJSON* sounds = cJSON_GetObjectItemCaseSensitive(root, "sounds");
      const cJSON* asset_root = cJSON_IsObject(sounds) ? sounds : root;
      const cJSON* asset = nullptr;
      cJSON_ArrayForEach(asset, asset_root) {
        if (!cJSON_IsObject(asset) || asset->string == nullptr) continue;
        if (asset_root == root && std::strcmp(asset->string, "profiles") == 0) continue;
        SoundAsset sound_asset;
        sound_asset.sound_id = asset->string;
        loadSoundAssetFromJson(asset, &sound_asset);
        if (!sound_asset.file_path.empty() && sound_asset.file_path.front() != '/') {
          sound_asset.file_path = std::string(app::config::kInternalMountPoint) + "/" + sound_asset.file_path;
        }
        if (!sound_asset.file_path.empty() || !sound_asset.stream_url.empty()) {
          sound_manifest_[sound_asset.sound_id] = sound_asset;
        }
      }
      cJSON_Delete(root);
    }
  }

  if (sound_manifest_.empty()) loadDefaultManifest();
  refreshBellLibrary();
  return ESP_OK;
}

esp_err_t ConfigService::refreshBellLibrary() {
  for (auto item = sound_manifest_.begin(); item != sound_manifest_.end();) {
    if (item->first.rfind("bells/", 0) == 0) item = sound_manifest_.erase(item);
    else ++item;
  }
  const std::string directory = storage_.sdRootPath() + "/bells";
  if (!storage_.sdReady() || !storage_.exists(directory)) return ESP_ERR_NOT_FOUND;
  discoverBellDirectory(directory, "", 0);

  const auto fallback = sound_manifest_.find("default");
  if (fallback == sound_manifest_.end() || !storage_.exists(fallback->second.file_path)) {
    const auto replacement = std::find_if(sound_manifest_.begin(), sound_manifest_.end(),
        [this](const auto& item) {
          return item.first.rfind("bells/", 0) == 0 && storage_.exists(item.second.file_path);
        });
    if (replacement != sound_manifest_.end()) {
      SoundAsset default_asset = replacement->second;
      default_asset.sound_id = "default";
      sound_manifest_["default"] = std::move(default_asset);
    }
  }
  return ESP_OK;
}

void ConfigService::discoverBellDirectory(const std::string& directory,
                                          const std::string& relative_path,
                                          size_t depth) {
  if (depth > 8) return;
  DIR* handle = opendir(directory.c_str());
  if (handle == nullptr) return;
  while (const dirent* entry = readdir(handle)) {
    const std::string name = entry->d_name;
    if (name == "." || name == ".." || name.empty() || name.front() == '.') continue;
    const std::string full_path = directory + "/" + name;
    const std::string relative = relative_path.empty() ? name : relative_path + "/" + name;
    struct stat info = {};
    if (stat(full_path.c_str(), &info) != 0) continue;
    if (S_ISDIR(info.st_mode)) {
      discoverBellDirectory(full_path, relative, depth + 1);
      continue;
    }
    if (!S_ISREG(info.st_mode)) continue;
    const size_t dot = name.find_last_of('.');
    if (dot == std::string::npos) continue;
    std::string extension = name.substr(dot + 1);
    std::transform(extension.begin(), extension.end(), extension.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    if (extension != "mp3" && extension != "wav") continue;
    const std::string sound_id = "bells/" + relative;
    sound_manifest_[sound_id] = SoundAsset{
        sound_id,
        extension == "mp3" ? "sd-mp3" : "sd-default",
        full_path,
        "",
        0};
  }
  closedir(handle);
}

const SoundAsset* ConfigService::resolveSound(const std::string& sound_id) const {
  const auto found = sound_manifest_.find(sound_id);
  if (found != sound_manifest_.end()) return &found->second;
  const auto fallback = sound_manifest_.find("default");
  return fallback == sound_manifest_.end() ? nullptr : &fallback->second;
}

esp_err_t ConfigService::saveDeviceConfig(const DeviceConfig& config) {
  device_config_ = config;
  cJSON* root = cJSON_CreateObject();
  if (root == nullptr) return ESP_ERR_NO_MEM;
  cJSON_AddStringToObject(root, "device_id", config.device_id.c_str());
  cJSON_AddStringToObject(root, "school_name", config.school_name.c_str());
  cJSON_AddStringToObject(root, "timezone", config.timezone.c_str());
  cJSON_AddStringToObject(root, "timezone_posix", config.timezone_posix.c_str());
  cJSON_AddNumberToObject(root, "volume_percent", config.volume_percent);

  cJSON* announcement = cJSON_AddObjectToObject(root, "announcement");
  cJSON_AddBoolToObject(announcement, "physical_ptt_enabled", config.physical_ptt_enabled);
  cJSON_AddNumberToObject(announcement, "mic_gain_percent", config.physical_ptt_gain_percent);

  cJSON* wifi = cJSON_AddObjectToObject(root, "wifi");
  cJSON_AddStringToObject(wifi, "mode", config.wifi.mode.c_str());
  cJSON_AddStringToObject(wifi, "ssid", config.wifi.ssid.c_str());
  cJSON_AddStringToObject(wifi, "password", config.wifi.password.c_str());

  cJSON* sync = cJSON_AddObjectToObject(root, "sync");
  cJSON_AddStringToObject(sync, "source", config.sync.source.c_str());
  cJSON_AddStringToObject(sync, "last_sync_utc", config.sync.last_sync_utc.c_str());
  cJSON_AddNumberToObject(sync, "content_version", config.sync.content_version);

  char* payload = cJSON_PrintUnformatted(root);
  cJSON_Delete(root);
  if (payload == nullptr) return ESP_ERR_NO_MEM;
  const esp_err_t err = storage_.writeTextAtomic(app::config::kDeviceConfigPath, payload);
  cJSON_free(payload);
  return err;
}

esp_err_t ConfigService::registerSoundFile(const std::string& file_name, const std::string& sound_id) {
  return registerSoundPath(storage_.rootPath() + "/sounds/" + file_name, sound_id);
}

esp_err_t ConfigService::registerSoundPath(const std::string& file_path, const std::string& sound_id) {
  const size_t slash = file_path.find_last_of("/\\");
  const std::string file_name = slash == std::string::npos ? file_path : file_path.substr(slash + 1);
  if (file_name.empty() || sound_id.empty()) return ESP_ERR_INVALID_ARG;
  std::string extension;
  const size_t dot = file_name.find_last_of('.');
  if (dot != std::string::npos) {
    extension = file_name.substr(dot + 1);
    std::transform(extension.begin(), extension.end(), extension.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  }
  if (extension != "mp3" && extension != "wav") return ESP_ERR_NOT_SUPPORTED;

  const SoundAsset asset{
      sound_id,
      extension == "mp3" ? "internal-mp3" : "internal-wav",
      file_path,
      "",
      app::config::kDefaultBellDurationSeconds};
  sound_manifest_[sound_id] = asset;

  const auto fallback = sound_manifest_.find("default");
  if (fallback == sound_manifest_.end() || !storage_.exists(fallback->second.file_path)) {
    SoundAsset default_asset = asset;
    default_asset.sound_id = "default";
    sound_manifest_["default"] = default_asset;
  }
  return saveSoundManifest();
}

esp_err_t ConfigService::unregisterSoundFile(const std::string& sound_id) {
  const auto found = sound_manifest_.find(sound_id);
  if (found == sound_manifest_.end()) return ESP_ERR_NOT_FOUND;
  const std::string removed_path = found->second.file_path;
  for (auto item = sound_manifest_.begin(); item != sound_manifest_.end();) {
    if (item->second.file_path == removed_path) item = sound_manifest_.erase(item);
    else ++item;
  }
  if (sound_manifest_.find("default") == sound_manifest_.end()) {
    const auto replacement = std::find_if(sound_manifest_.begin(), sound_manifest_.end(), [this](const auto& item) {
      return !item.second.file_path.empty() && storage_.exists(item.second.file_path);
    });
    if (replacement != sound_manifest_.end()) {
      SoundAsset fallback = replacement->second;
      fallback.sound_id = "default";
      sound_manifest_["default"] = std::move(fallback);
    }
  }
  return saveSoundManifest();
}

esp_err_t ConfigService::saveSoundManifest() const {
  cJSON* root = cJSON_CreateObject();
  if (root == nullptr) return ESP_ERR_NO_MEM;
  cJSON* profiles = cJSON_AddObjectToObject(root, "profiles");
  for (const auto& [id, profile] : audio_profiles_) {
    cJSON* item = cJSON_AddObjectToObject(profiles, id.c_str());
    cJSON_AddStringToObject(item, "name", profile.name.c_str());
    cJSON_AddStringToObject(item, "source", profile.source_type.c_str());
    cJSON_AddStringToObject(item, "transport", profile.transport.c_str());
    cJSON_AddStringToObject(item, "format", profile.format.c_str());
    if (!profile.endpoint.empty()) cJSON_AddStringToObject(item, "endpoint", profile.endpoint.c_str());
    cJSON_AddBoolToObject(item, "enabled", profile.enabled);
  }

  cJSON* sounds = cJSON_AddObjectToObject(root, "sounds");
  for (const auto& [id, asset] : sound_manifest_) {
    cJSON* item = cJSON_AddObjectToObject(sounds, id.c_str());
    cJSON_AddStringToObject(item, "profile", asset.profile_id.c_str());
    if (!asset.file_path.empty()) {
      std::string path = asset.file_path;
      const std::string prefix = std::string(app::config::kInternalMountPoint) + "/";
      if (path.rfind(prefix, 0) == 0) path.erase(0, prefix.size());
      cJSON_AddStringToObject(item, "file", path.c_str());
    }
    if (!asset.stream_url.empty()) cJSON_AddStringToObject(item, "url", asset.stream_url.c_str());
    cJSON_AddNumberToObject(item, "duration", asset.duration_seconds);
  }

  char* payload = cJSON_PrintUnformatted(root);
  cJSON_Delete(root);
  if (payload == nullptr) return ESP_ERR_NO_MEM;
  const esp_err_t err = storage_.writeTextAtomic(app::config::kSoundsManifestPath, payload);
  cJSON_free(payload);
  return err;
}

void ConfigService::loadDefaultAudioProfiles() {
  audio_profiles_.clear();
  audio_profiles_["internal-wav"] = AudioProfile{
      "internal-wav",
      "Internal Flash WAV",
      "internal-flash",
      "file",
      "wav",
      "",
      true};
  audio_profiles_["internal-mp3"] = AudioProfile{
      "internal-mp3",
      "Internal Flash MP3",
      "internal-flash",
      "file",
      "mp3",
      "",
      true};
  audio_profiles_["sd-default"] = AudioProfile{
      "sd-default",
      "SD Card WAV",
      "sd-card",
      "file",
      "wav",
      "",
      true};
  audio_profiles_["sd-mp3"] = AudioProfile{
      "sd-mp3",
      "SD Card MP3",
      "sd-card",
      "file",
      "mp3",
      "",
      true};
}

void ConfigService::loadDefaultManifest() {
  sound_manifest_.clear();
  sound_manifest_["default"] = SoundAsset{
      "default",
      "internal-wav",
      std::string(app::config::kInternalMountPoint) + "/sounds/default.wav",
      "",
      5};
  sound_manifest_["school"] = SoundAsset{
      "school",
      "internal-wav",
      std::string(app::config::kInternalMountPoint) + "/sounds/school.wav",
      "",
      10};
}

}  // namespace app::services
