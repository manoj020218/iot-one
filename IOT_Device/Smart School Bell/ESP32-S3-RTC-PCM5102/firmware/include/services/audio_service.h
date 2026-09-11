#pragma once

#include <cstddef>
#include <cstdio>
#include <atomic>

#include "app_types.h"
#include "drivers/pcm5102_i2s.h"
#include "esp_err.h"
#include "esp_adc/adc_continuous.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include "services/storage_service.h"

namespace app::services {

class AudioService {
 public:
  AudioService(StorageService& storage, drivers::Pcm5102I2s& pcm5102) : storage_(storage), pcm5102_(pcm5102) {}

  esp_err_t init(uint8_t volume_percent, bool physical_ptt_enabled, uint16_t physical_ptt_gain_percent);
  void setAudioProfiles(const AudioProfileMap& audio_profiles);
  void setSoundManifest(const SoundManifest& sound_manifest);
  void setVolume(uint8_t volume_percent);
  void setPhysicalPttConfig(bool enabled, uint16_t mic_gain_percent);
  void tick();
  esp_err_t play(const RingRequest& request);
  esp_err_t playDiagnosticTone();
  bool announcementSupported() const { return announcement_supported_.load(); }
  bool pttPressed() const { return ptt_pressed_.load(); }
  bool announcementActive() const { return announcement_active_.load(); }
  bool bellActive() const { return bell_active_.load(); }
  bool audioBusy() const { return announcement_active_.load() || bell_active_.load(); }
  const char* busyReason() const;
  uint16_t physicalPttGainPercent() const { return physical_ptt_gain_percent_.load(); }
  bool physicalPttEnabled() const { return physical_ptt_enabled_.load(); }
  esp_err_t startSoftAnnouncement();
  esp_err_t pushSoftAnnouncementPcm(const uint8_t* pcm_bytes, size_t byte_count);
  void stopSoftAnnouncement();
  bool softAnnouncementActive() const { return soft_announcement_active_.load(); }

 private:
  struct WaveFormat {
    uint16_t audio_format = 0;
    uint16_t channels = 0;
    uint32_t sample_rate = 0;
    uint16_t bits_per_sample = 0;
    uint32_t data_offset = 0;
    uint32_t data_size = 0;
  };

  const SoundAsset* resolveAsset(const std::string& sound_id) const;
  const AudioProfile* resolveProfile(const std::string& profile_id) const;
  esp_err_t playUnlocked(const RingRequest& request);
  esp_err_t playSdWave(const SoundAsset& asset, const RingRequest& request);
  esp_err_t playSdMp3(const SoundAsset& asset, const RingRequest& request);
  esp_err_t playHttpWave(const SoundAsset& asset, const AudioProfile& profile, const RingRequest& request);
  esp_err_t parseWaveBuffer(const uint8_t* data, size_t data_size, WaveFormat* format) const;
  esp_err_t parseWaveFile(FILE* file, WaveFormat* format) const;
  esp_err_t initPhysicalPtt();
  static void physicalPttTaskEntry(void* context);
  void physicalPttTask();
  esp_err_t startPhysicalAnnouncement();
  void stopPhysicalAnnouncement();
  void processMicrophoneFrame(const uint8_t* raw_data, uint32_t raw_bytes);

  StorageService& storage_;
  drivers::Pcm5102I2s& pcm5102_;
  AudioProfileMap audio_profiles_;
  SoundManifest sound_manifest_;
  SemaphoreHandle_t playback_mutex_ = nullptr;
  uint8_t volume_percent_ = 80;
  adc_continuous_handle_t announcement_adc_ = nullptr;
  TaskHandle_t physical_ptt_task_ = nullptr;
  std::atomic<bool> announcement_supported_{false};
  std::atomic<bool> physical_ptt_enabled_{true};
  std::atomic<uint16_t> physical_ptt_gain_percent_{200};
  std::atomic<bool> ptt_pressed_{false};
  std::atomic<bool> announcement_active_{false};
  std::atomic<bool> soft_announcement_active_{false};
  std::atomic<int64_t> soft_last_frame_us_{0};
  std::atomic<bool> bell_pending_{false};
  std::atomic<bool> bell_active_{false};
  int32_t mic_dc_estimate_q8_ = 0;
  bool mic_dc_initialized_ = false;
};

}  // namespace app::services
