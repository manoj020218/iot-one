#include "services/audio_service.h"

#include <algorithm>
#include <array>
#include <cstdlib>
#include <cstdio>
#include <cstring>
#include <vector>

#include "app_config.h"
#include "board_pins.h"
#include "drivers/button_driver.h"
#include "driver/gpio.h"
#include "esp_audio_dec_default.h"
#include "esp_audio_simple_dec.h"
#include "esp_audio_simple_dec_default.h"
#include "esp_check.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "soc/soc_caps.h"

namespace app::services {

namespace {
constexpr char kTag[] = "AudioService";

uint16_t readLe16(const uint8_t* data) { return static_cast<uint16_t>(data[0] | (static_cast<uint16_t>(data[1]) << 8)); }
uint32_t readLe32(const uint8_t* data) {
  return static_cast<uint32_t>(data[0]) | (static_cast<uint32_t>(data[1]) << 8) | (static_cast<uint32_t>(data[2]) << 16) |
         (static_cast<uint32_t>(data[3]) << 24);
}

bool isCanonicalWaveFormat(uint16_t audio_format, uint16_t channels, uint32_t sample_rate, uint16_t bits_per_sample) {
  return audio_format == 1 && channels == app::config::kCanonicalChannels &&
         sample_rate == app::config::kCanonicalSampleRate &&
         bits_per_sample == app::config::kCanonicalBitsPerSample;
}

bool isSupportedSdWaveFormat(uint16_t audio_format, uint16_t channels, uint32_t sample_rate, uint16_t bits_per_sample) {
  return audio_format == 1 && (channels == 1 || channels == 2) &&
         sample_rate >= 8000 && sample_rate <= 96000 &&
         (bits_per_sample == 8 || bits_per_sample == 16);
}

bool isHttpBackedProfile(const AudioProfile& profile) {
  return profile.source_type == "url" || profile.source_type == "vps" || profile.transport == "http" || profile.transport == "https";
}

esp_err_t writeCanonicalPcmBytes(
    drivers::Pcm5102I2s& pcm5102,
    const uint8_t* data,
    size_t data_size,
    uint8_t volume_percent,
    uint8_t* carry_byte,
    bool* has_carry) {
  if (data == nullptr || data_size == 0) return ESP_OK;
  if (carry_byte == nullptr || has_carry == nullptr) return ESP_ERR_INVALID_ARG;

  std::vector<uint8_t> sample_bytes(data_size + (*has_carry ? 1U : 0U), 0);
  size_t cursor = 0;
  if (*has_carry) {
    sample_bytes[cursor++] = *carry_byte;
    *has_carry = false;
  }

  std::memcpy(sample_bytes.data() + cursor, data, data_size);

  const size_t aligned_bytes = sample_bytes.size() & ~static_cast<size_t>(1U);
  if (aligned_bytes == 0) {
    *carry_byte = sample_bytes.front();
    *has_carry = true;
    return ESP_OK;
  }

  if (aligned_bytes != sample_bytes.size()) {
    *carry_byte = sample_bytes.back();
    *has_carry = true;
  }

  std::vector<int16_t> mono_buffer(aligned_bytes / sizeof(int16_t), 0);
  std::memcpy(mono_buffer.data(), sample_bytes.data(), aligned_bytes);
  return pcm5102.writeMonoSamplesDuplicated(mono_buffer.data(), mono_buffer.size(), volume_percent);
}
}  // namespace

esp_err_t AudioService::init(uint8_t volume_percent, bool physical_ptt_enabled, uint16_t physical_ptt_gain_percent) {
  volume_percent_ = std::clamp<uint8_t>(volume_percent, 0, 100);
  physical_ptt_enabled_.store(physical_ptt_enabled);
  physical_ptt_gain_percent_.store(std::clamp<uint16_t>(
      physical_ptt_gain_percent, 25, app::config::kAnnouncementMaxGainPercent));
  if (playback_mutex_ == nullptr) {
    playback_mutex_ = xSemaphoreCreateMutex();
    if (playback_mutex_ == nullptr) return ESP_ERR_NO_MEM;
  }
  const esp_err_t audio_result = pcm5102_.init();
  if (audio_result != ESP_OK) return audio_result;

  const esp_err_t ptt_result = initPhysicalPtt();
  if (ptt_result != ESP_OK) {
    ESP_LOGW(kTag, "Physical PTT unavailable: %s; bell playback remains enabled", esp_err_to_name(ptt_result));
  }
  return ESP_OK;
}

void AudioService::setAudioProfiles(const AudioProfileMap& audio_profiles) {
  if (playback_mutex_ != nullptr) xSemaphoreTake(playback_mutex_, portMAX_DELAY);
  audio_profiles_ = audio_profiles;
  if (playback_mutex_ != nullptr) xSemaphoreGive(playback_mutex_);
}

void AudioService::setSoundManifest(const SoundManifest& sound_manifest) {
  if (playback_mutex_ != nullptr) xSemaphoreTake(playback_mutex_, portMAX_DELAY);
  sound_manifest_ = sound_manifest;
  if (playback_mutex_ != nullptr) xSemaphoreGive(playback_mutex_);
}

void AudioService::setVolume(uint8_t volume_percent) {
  if (playback_mutex_ != nullptr) xSemaphoreTake(playback_mutex_, portMAX_DELAY);
  volume_percent_ = std::min<uint8_t>(volume_percent, 100);
  if (playback_mutex_ != nullptr) xSemaphoreGive(playback_mutex_);
}

void AudioService::setPhysicalPttConfig(bool enabled, uint16_t mic_gain_percent) {
  physical_ptt_gain_percent_.store(std::clamp<uint16_t>(
      mic_gain_percent, 25, app::config::kAnnouncementMaxGainPercent));
  physical_ptt_enabled_.store(enabled);
}

void AudioService::tick() {
  if (!soft_announcement_active_.load()) return;
  const int64_t idle_us = esp_timer_get_time() - soft_last_frame_us_.load();
  if (idle_us > static_cast<int64_t>(app::config::kSoftAnnouncementIdleTimeoutMs) * 1000) {
    ESP_LOGW(kTag, "Soft announcement stopped after input timeout");
    stopSoftAnnouncement();
  }
}

const char* AudioService::busyReason() const {
  if (bell_active_.load()) return "bell";
  if (soft_announcement_active_.load()) return "soft_announcement";
  if (announcement_active_.load()) return "physical_announcement";
  return "none";
}

esp_err_t AudioService::play(const RingRequest& request) {
  if (playback_mutex_ == nullptr) return ESP_ERR_INVALID_STATE;
  bell_pending_.store(true);
  if (xSemaphoreTake(playback_mutex_, pdMS_TO_TICKS(500)) != pdTRUE) {
    bell_pending_.store(false);
    ESP_LOGW(kTag, "Playback request rejected because audio is already active");
    return ESP_ERR_INVALID_STATE;
  }

  bell_active_.store(true);
  pcm5102_.stop();
  const esp_err_t result = playUnlocked(request);
  bell_active_.store(false);
  bell_pending_.store(false);
  xSemaphoreGive(playback_mutex_);
  return result;
}

esp_err_t AudioService::playDiagnosticTone() {
  if (playback_mutex_ == nullptr) return ESP_ERR_INVALID_STATE;
  bell_pending_.store(true);
  if (xSemaphoreTake(playback_mutex_, pdMS_TO_TICKS(500)) != pdTRUE) {
    bell_pending_.store(false);
    ESP_LOGW(kTag, "Diagnostic tone rejected because audio is already active");
    return ESP_ERR_INVALID_STATE;
  }

  bell_active_.store(true);
  pcm5102_.stop();
  ESP_LOGI(kTag, "Playing 1000 Hz diagnostic tone for 2 seconds at %u%% volume", volume_percent_);
  esp_err_t result = pcm5102_.configureSampleRate(app::config::kCanonicalSampleRate);
  if (result == ESP_OK) {
    result = pcm5102_.playDiagnosticTone(1000, 2000, volume_percent_);
  }
  pcm5102_.stop();
  ESP_LOGI(kTag, "Diagnostic tone finished: %s", esp_err_to_name(result));
  bell_active_.store(false);
  bell_pending_.store(false);
  xSemaphoreGive(playback_mutex_);
  return result;
}

esp_err_t AudioService::initPhysicalPtt() {
  if (board::kAnnouncementPtt == GPIO_NUM_NC || board::kAnnouncementMicAdc == GPIO_NUM_NC) {
    return ESP_ERR_NOT_SUPPORTED;
  }

  ESP_RETURN_ON_ERROR(
      drivers::ButtonDriver::configureActiveLow(board::kAnnouncementPtt),
      kTag,
      "PTT GPIO config failed");

  adc_continuous_handle_cfg_t handle_config = {};
  handle_config.max_store_buf_size = app::config::kAnnouncementAdcPoolBytes;
  handle_config.conv_frame_size = app::config::kAnnouncementAdcFrameSamples * SOC_ADC_DIGI_RESULT_BYTES;
  ESP_RETURN_ON_ERROR(
      adc_continuous_new_handle(&handle_config, &announcement_adc_),
      kTag,
      "announcement ADC create failed");

  adc_digi_pattern_config_t pattern = {};
  pattern.atten = ADC_ATTEN_DB_12;
  pattern.channel = board::kAnnouncementMicAdcChannel;
  pattern.unit = board::kAnnouncementMicAdcUnit;
  pattern.bit_width = ADC_BITWIDTH_12;

  adc_continuous_config_t adc_config = {};
  adc_config.pattern_num = 1;
  adc_config.adc_pattern = &pattern;
  adc_config.sample_freq_hz = app::config::kAnnouncementSampleRate;
  adc_config.conv_mode = ADC_CONV_SINGLE_UNIT_1;
  adc_config.format = ADC_DIGI_OUTPUT_FORMAT_TYPE2;
  const esp_err_t config_result = adc_continuous_config(announcement_adc_, &adc_config);
  if (config_result != ESP_OK) {
    adc_continuous_deinit(announcement_adc_);
    announcement_adc_ = nullptr;
    return config_result;
  }

  if (xTaskCreate(
          &AudioService::physicalPttTaskEntry,
          "physical_ptt",
          app::config::kAnnouncementTaskStackBytes,
          this,
          6,
          &physical_ptt_task_) != pdPASS) {
    adc_continuous_deinit(announcement_adc_);
    announcement_adc_ = nullptr;
    return ESP_ERR_NO_MEM;
  }

  announcement_supported_.store(true);
  ESP_LOGI(
      kTag,
      "Physical PTT ready: switch GPIO%d to GND, microphone ADC GPIO%d (ADC1_CH6), %lu Hz",
      board::kAnnouncementPtt,
      board::kAnnouncementMicAdc,
      static_cast<unsigned long>(app::config::kAnnouncementSampleRate));
  return ESP_OK;
}

void AudioService::physicalPttTaskEntry(void* context) {
  static_cast<AudioService*>(context)->physicalPttTask();
}

void AudioService::physicalPttTask() {
  bool candidate_pressed = false;
  bool stable_pressed = false;
  int64_t candidate_since_ms = esp_timer_get_time() / 1000;

  while (true) {
    const bool raw_pressed = physical_ptt_enabled_.load() &&
                             drivers::ButtonDriver::activeLowPressed(board::kAnnouncementPtt);
    const int64_t now_ms = esp_timer_get_time() / 1000;
    if (raw_pressed != candidate_pressed) {
      candidate_pressed = raw_pressed;
      candidate_since_ms = now_ms;
    }
    if (candidate_pressed != stable_pressed &&
        now_ms - candidate_since_ms >= static_cast<int64_t>(app::config::kAnnouncementPttDebounceMs)) {
      stable_pressed = candidate_pressed;
      ptt_pressed_.store(stable_pressed);
      if (stable_pressed) {
        const esp_err_t result = startPhysicalAnnouncement();
        if (result != ESP_OK) {
          ESP_LOGE(kTag, "Unable to start physical announcement: %s", esp_err_to_name(result));
        }
      } else {
        stopPhysicalAnnouncement();
      }
    }

    if (!announcement_active_.load()) {
      vTaskDelay(pdMS_TO_TICKS(10));
      continue;
    }

    std::array<uint8_t, app::config::kAnnouncementAdcFrameSamples * SOC_ADC_DIGI_RESULT_BYTES> raw_data = {};
    uint32_t bytes_read = 0;
    const esp_err_t read_result = adc_continuous_read(
        announcement_adc_, raw_data.data(), raw_data.size(), &bytes_read, 50);
    if (read_result == ESP_OK && bytes_read > 0) {
      processMicrophoneFrame(raw_data.data(), bytes_read);
    } else if (read_result != ESP_ERR_TIMEOUT) {
      ESP_LOGW(kTag, "Announcement ADC read failed: %s", esp_err_to_name(read_result));
      vTaskDelay(pdMS_TO_TICKS(10));
    }
  }
}

esp_err_t AudioService::startPhysicalAnnouncement() {
  if (!announcement_supported_.load() || announcement_adc_ == nullptr || !physical_ptt_enabled_.load()) {
    return ESP_ERR_INVALID_STATE;
  }
  if (soft_announcement_active_.load()) return ESP_ERR_INVALID_STATE;
  adc_continuous_flush_pool(announcement_adc_);
  mic_dc_estimate_q8_ = 0;
  mic_dc_initialized_ = false;
  ESP_RETURN_ON_ERROR(adc_continuous_start(announcement_adc_), kTag, "announcement ADC start failed");
  announcement_active_.store(true);
  ESP_LOGI(kTag, "Physical PTT announcement started");
  return ESP_OK;
}

void AudioService::stopPhysicalAnnouncement() {
  if (!announcement_active_.load() || soft_announcement_active_.load()) return;
  announcement_active_.store(false);
  if (announcement_adc_ != nullptr) {
    const esp_err_t stop_result = adc_continuous_stop(announcement_adc_);
    if (stop_result != ESP_OK) ESP_LOGW(kTag, "Announcement ADC stop failed: %s", esp_err_to_name(stop_result));
  }

  if (!bell_pending_.load() && playback_mutex_ != nullptr &&
      xSemaphoreTake(playback_mutex_, pdMS_TO_TICKS(250)) == pdTRUE) {
    if (!bell_active_.load()) pcm5102_.stop();
    xSemaphoreGive(playback_mutex_);
  }
  ESP_LOGI(kTag, "Physical PTT announcement stopped");
}

esp_err_t AudioService::startSoftAnnouncement() {
  if (soft_announcement_active_.load()) {
    soft_last_frame_us_.store(esp_timer_get_time());
    return ESP_OK;
  }
  if (announcement_active_.load()) return ESP_ERR_INVALID_STATE;
  soft_last_frame_us_.store(esp_timer_get_time());
  soft_announcement_active_.store(true);
  announcement_active_.store(true);
  ESP_LOGI(kTag, "Soft PTT announcement started");
  return ESP_OK;
}

esp_err_t AudioService::pushSoftAnnouncementPcm(const uint8_t* pcm_bytes, size_t byte_count) {
  if (!soft_announcement_active_.load() || pcm_bytes == nullptr || byte_count == 0 ||
      (byte_count % sizeof(int16_t)) != 0 || byte_count > app::config::kSoftAnnouncementMaxFrameBytes) {
    return ESP_ERR_INVALID_ARG;
  }
  soft_last_frame_us_.store(esp_timer_get_time());
  if (bell_pending_.load() || bell_active_.load()) return ESP_OK;
  if (playback_mutex_ == nullptr || xSemaphoreTake(playback_mutex_, pdMS_TO_TICKS(100)) != pdTRUE) {
    return ESP_ERR_TIMEOUT;
  }
  esp_err_t result = ESP_OK;
  if (!bell_pending_.load() && !bell_active_.load() && soft_announcement_active_.load()) {
    result = pcm5102_.configureSampleRate(app::config::kAnnouncementSampleRate);
    if (result == ESP_OK) {
      result = pcm5102_.writeMonoSamplesDuplicated(
          reinterpret_cast<const int16_t*>(pcm_bytes),
          byte_count / sizeof(int16_t),
          volume_percent_,
          pdMS_TO_TICKS(100));
    }
  }
  xSemaphoreGive(playback_mutex_);
  return result;
}

void AudioService::stopSoftAnnouncement() {
  if (!soft_announcement_active_.exchange(false)) return;
  announcement_active_.store(false);
  if (!bell_pending_.load() && playback_mutex_ != nullptr &&
      xSemaphoreTake(playback_mutex_, pdMS_TO_TICKS(250)) == pdTRUE) {
    if (!bell_active_.load()) pcm5102_.stop();
    xSemaphoreGive(playback_mutex_);
  }
  ESP_LOGI(kTag, "Soft PTT announcement stopped");
}

void AudioService::processMicrophoneFrame(const uint8_t* raw_data, uint32_t raw_bytes) {
  if (raw_data == nullptr || raw_bytes < SOC_ADC_DIGI_RESULT_BYTES) return;
  std::array<int16_t, app::config::kAnnouncementAdcFrameSamples> pcm = {};
  size_t sample_count = 0;
  const uint16_t gain_percent = physical_ptt_gain_percent_.load();

  for (uint32_t offset = 0;
       offset + SOC_ADC_DIGI_RESULT_BYTES <= raw_bytes && sample_count < pcm.size();
       offset += SOC_ADC_DIGI_RESULT_BYTES) {
    const auto* sample = reinterpret_cast<const adc_digi_output_data_t*>(raw_data + offset);
    if (sample->type2.unit != 0 || sample->type2.channel != board::kAnnouncementMicAdcChannel) continue;

    const int32_t raw_q8 = static_cast<int32_t>(sample->type2.data) << 8;
    if (!mic_dc_initialized_) {
      mic_dc_estimate_q8_ = raw_q8;
      mic_dc_initialized_ = true;
    }
    // Slow DC tracker removes the 1.65 V microphone bias while preserving speech.
    mic_dc_estimate_q8_ += (raw_q8 - mic_dc_estimate_q8_) >> 11;
    const int32_t centered_adc = (raw_q8 - mic_dc_estimate_q8_) >> 8;
    const int32_t amplified = centered_adc * 16 * gain_percent / 100;
    pcm[sample_count++] = static_cast<int16_t>(std::clamp<int32_t>(amplified, -32768, 32767));
  }

  if (sample_count == 0 || bell_pending_.load() || bell_active_.load() || playback_mutex_ == nullptr) return;
  if (xSemaphoreTake(playback_mutex_, 0) != pdTRUE) return;
  esp_err_t result = ESP_OK;
  if (!bell_pending_.load() && !bell_active_.load() && announcement_active_.load()) {
    result = pcm5102_.configureSampleRate(app::config::kAnnouncementSampleRate);
    if (result == ESP_OK) {
      result = pcm5102_.writeMonoSamplesDuplicated(
          pcm.data(), sample_count, volume_percent_, pdMS_TO_TICKS(100));
    }
  }
  xSemaphoreGive(playback_mutex_);
  if (result != ESP_OK) ESP_LOGW(kTag, "Announcement audio output failed: %s", esp_err_to_name(result));
}

esp_err_t AudioService::playUnlocked(const RingRequest& request) {
  const SoundAsset* asset = resolveAsset(request.sound_id);
  if (asset == nullptr) {
    ESP_LOGE(kTag, "No sound asset for id '%s'", request.sound_id.c_str());
    return ESP_ERR_NOT_FOUND;
  }

  const AudioProfile* profile = resolveProfile(asset->profile_id);
  if (profile == nullptr) {
    ESP_LOGE(kTag, "No audio profile for sound '%s' (profile='%s')", request.sound_id.c_str(), asset->profile_id.c_str());
    return ESP_ERR_NOT_FOUND;
  }

  if (!profile->enabled) {
    ESP_LOGW(kTag, "Audio profile '%s' is disabled", profile->profile_id.c_str());
    return ESP_ERR_INVALID_STATE;
  }

  if (profile->source_type == "sd-card" || profile->source_type == "internal-flash") {
    if (profile->format == "wav") return playSdWave(*asset, request);
    if (profile->format == "mp3") return playSdMp3(*asset, request);
    ESP_LOGE(kTag, "SD profile '%s' uses unsupported format '%s'", profile->profile_id.c_str(), profile->format.c_str());
    return ESP_ERR_NOT_SUPPORTED;
  }

  if (isHttpBackedProfile(*profile)) {
    if (profile->format != "wav") {
      ESP_LOGE(
          kTag,
          "HTTP profile '%s' requires unsupported format '%s'",
          profile->profile_id.c_str(),
          profile->format.c_str());
      return ESP_ERR_NOT_SUPPORTED;
    }
    return playHttpWave(*asset, *profile, request);
  }

  ESP_LOGE(
      kTag,
      "Unsupported audio source '%s' (transport='%s', format='%s')",
      profile->source_type.c_str(),
      profile->transport.c_str(),
      profile->format.c_str());
  return ESP_ERR_NOT_SUPPORTED;
}

esp_err_t AudioService::playSdWave(const SoundAsset& asset, const RingRequest& request) {
  if (asset.file_path.empty()) {
    ESP_LOGE(kTag, "No SD sound file configured for asset '%s'", asset.sound_id.c_str());
    return ESP_ERR_INVALID_ARG;
  }

  FILE* file = std::fopen(asset.file_path.c_str(), "rb");
  if (file == nullptr) {
    ESP_LOGE(kTag, "Unable to open SD sound file %s", asset.file_path.c_str());
    return ESP_ERR_NOT_FOUND;
  }

  WaveFormat format;
  const esp_err_t parse_result = parseWaveFile(file, &format);
  if (parse_result != ESP_OK || !isSupportedSdWaveFormat(format.audio_format, format.channels, format.sample_rate, format.bits_per_sample)) {
    ESP_LOGE(kTag, "Unsupported SD WAV format for %s", asset.file_path.c_str());
    std::fclose(file);
    return parse_result == ESP_OK ? ESP_ERR_INVALID_RESPONSE : parse_result;
  }

  esp_err_t result = pcm5102_.configureSampleRate(format.sample_rate);
  if (result != ESP_OK) {
    std::fclose(file);
    return result;
  }

  std::fseek(file, static_cast<long>(format.data_offset), SEEK_SET);
  uint32_t bytes_remaining = format.data_size;
  const uint32_t bytes_per_frame = format.channels * (format.bits_per_sample / 8U);
  if (request.duration_seconds > 0) {
    const uint64_t duration_bytes =
        static_cast<uint64_t>(format.sample_rate) * bytes_per_frame * request.duration_seconds;
    bytes_remaining = static_cast<uint32_t>(std::min<uint64_t>(bytes_remaining, duration_bytes));
  }

  std::vector<uint8_t> input_buffer(app::config::kAudioChunkSamples * bytes_per_frame, 0);
  std::vector<int16_t> pcm_buffer(app::config::kAudioChunkSamples * format.channels, 0);
  while (bytes_remaining > 0) {
    const size_t bytes_to_read = std::min<size_t>(bytes_remaining, input_buffer.size());
    const size_t bytes_read = std::fread(input_buffer.data(), 1, bytes_to_read, file);
    if (bytes_read == 0) {
      result = ESP_FAIL;
      break;
    }

    const size_t frame_count = bytes_read / bytes_per_frame;
    if (frame_count == 0 || (bytes_read % bytes_per_frame) != 0) {
      result = ESP_ERR_INVALID_SIZE;
      break;
    }

    if (format.bits_per_sample == 16) {
      std::memcpy(pcm_buffer.data(), input_buffer.data(), bytes_read);
    } else {
      const size_t sample_count = frame_count * format.channels;
      for (size_t sample = 0; sample < sample_count; ++sample) {
        pcm_buffer[sample] = static_cast<int16_t>((static_cast<int32_t>(input_buffer[sample]) - 128) << 8);
      }
    }

    result = pcm5102_.writePcm16(pcm_buffer.data(), frame_count, format.channels, volume_percent_);
    if (result != ESP_OK) break;
    bytes_remaining -= static_cast<uint32_t>(bytes_read);
  }

  std::fclose(file);
  pcm5102_.stop();
  return result;
}

esp_err_t AudioService::playSdMp3(const SoundAsset& asset, const RingRequest& request) {
  if (asset.file_path.empty()) return ESP_ERR_INVALID_ARG;

  FILE* file = std::fopen(asset.file_path.c_str(), "rb");
  if (file == nullptr) {
    ESP_LOGE(kTag, "Unable to open SD MP3 file %s", asset.file_path.c_str());
    return ESP_ERR_NOT_FOUND;
  }

  esp_err_t result = ESP_OK;
  esp_audio_simple_dec_handle_t decoder = nullptr;
  bool audio_registry_active = false;
  bool simple_registry_active = false;

  if (esp_audio_dec_register_default() != ESP_AUDIO_ERR_OK) {
    result = ESP_ERR_NOT_SUPPORTED;
  } else {
    audio_registry_active = true;
  }
  if (result == ESP_OK && esp_audio_simple_dec_register_default() != ESP_AUDIO_ERR_OK) {
    result = ESP_ERR_NOT_SUPPORTED;
  } else if (result == ESP_OK) {
    simple_registry_active = true;
  }

  esp_audio_simple_dec_cfg_t decoder_config = {};
  decoder_config.dec_type = ESP_AUDIO_SIMPLE_DEC_TYPE_MP3;
  decoder_config.use_frame_dec = false;
  if (result == ESP_OK && esp_audio_simple_dec_open(&decoder_config, &decoder) != ESP_AUDIO_ERR_OK) {
    result = ESP_FAIL;
  }

  std::vector<uint8_t> input_buffer(2048, 0);
  std::vector<int16_t> output_buffer(4096, 0);
  bool stream_configured = false;
  uint8_t stream_channels = 0;
  uint64_t frames_written = 0;
  uint64_t max_frames = 0;
  uint64_t decoded_pcm_bytes = 0;
  uint32_t peak_sample = 0;
  bool duration_reached = false;

  while (result == ESP_OK && !duration_reached) {
    const size_t bytes_read = std::fread(input_buffer.data(), 1, input_buffer.size(), file);
    if (bytes_read == 0) {
      if (std::ferror(file)) result = ESP_FAIL;
      break;
    }

    esp_audio_simple_dec_raw_t raw = {};
    raw.buffer = input_buffer.data();
    raw.len = static_cast<uint32_t>(bytes_read);
    raw.eos = std::feof(file) != 0;

    while (raw.len > 0 && result == ESP_OK && !duration_reached) {
      esp_audio_simple_dec_out_t output = {};
      output.buffer = reinterpret_cast<uint8_t*>(output_buffer.data());
      output.len = static_cast<uint32_t>(output_buffer.size() * sizeof(int16_t));

      const esp_audio_err_t decode_result = esp_audio_simple_dec_process(decoder, &raw, &output);
      if (decode_result == ESP_AUDIO_ERR_BUFF_NOT_ENOUGH && output.needed_size > output.len) {
        output_buffer.resize((output.needed_size + sizeof(int16_t) - 1) / sizeof(int16_t));
        continue;
      }
      if (decode_result != ESP_AUDIO_ERR_OK) {
        ESP_LOGE(kTag, "MP3 decode failed for %s (%d)", asset.file_path.c_str(), static_cast<int>(decode_result));
        result = ESP_FAIL;
        break;
      }

      if (output.decoded_size > 0) {
        decoded_pcm_bytes += output.decoded_size;
        const size_t decoded_samples = output.decoded_size / sizeof(int16_t);
        for (size_t sample = 0; sample < decoded_samples; ++sample) {
          const int32_t value = static_cast<int32_t>(output_buffer[sample]);
          peak_sample = std::max<uint32_t>(peak_sample, static_cast<uint32_t>(value < 0 ? -value : value));
        }
        if (!stream_configured) {
          esp_audio_simple_dec_info_t info = {};
          if (esp_audio_simple_dec_get_info(decoder, &info) != ESP_AUDIO_ERR_OK ||
              info.bits_per_sample != 16 || (info.channel != 1 && info.channel != 2)) {
            result = ESP_ERR_NOT_SUPPORTED;
            break;
          }
          result = pcm5102_.configureSampleRate(info.sample_rate);
          if (result != ESP_OK) break;
          stream_channels = info.channel;
          max_frames = request.duration_seconds > 0
                           ? static_cast<uint64_t>(info.sample_rate) * request.duration_seconds
                           : 0;
          stream_configured = true;
          ESP_LOGI(kTag, "Playing MP3 at %lu Hz, %u channel(s)",
                   static_cast<unsigned long>(info.sample_rate), info.channel);
        }

        const size_t bytes_per_frame = stream_channels * sizeof(int16_t);
        size_t frame_count = output.decoded_size / bytes_per_frame;
        if ((output.decoded_size % bytes_per_frame) != 0) {
          result = ESP_ERR_INVALID_SIZE;
          break;
        }
        if (max_frames > 0 && frames_written + frame_count > max_frames) {
          frame_count = static_cast<size_t>(max_frames - frames_written);
        }
        if (frame_count > 0) {
          result = pcm5102_.writePcm16(
              reinterpret_cast<const int16_t*>(output.buffer),
              frame_count,
              stream_channels,
              volume_percent_);
          frames_written += frame_count;
        }
        duration_reached = max_frames > 0 && frames_written >= max_frames;
      }

      if (raw.consumed == 0) {
        if (output.decoded_size == 0) result = ESP_FAIL;
        break;
      }
      const uint32_t consumed = std::min(raw.len, raw.consumed);
      raw.len -= consumed;
      raw.buffer += consumed;
    }
  }

  if (decoder != nullptr) esp_audio_simple_dec_close(decoder);
  if (simple_registry_active) esp_audio_simple_dec_unregister_default();
  if (audio_registry_active) esp_audio_dec_unregister_default();
  std::fclose(file);
  pcm5102_.stop();
  ESP_LOGI(kTag, "MP3 output summary: frames=%llu, pcm_bytes=%llu, peak=%lu, volume=%u%%, result=%s",
           static_cast<unsigned long long>(frames_written),
           static_cast<unsigned long long>(decoded_pcm_bytes),
           static_cast<unsigned long>(peak_sample),
           volume_percent_,
           esp_err_to_name(result));
  if (result == ESP_OK && !stream_configured) result = ESP_ERR_INVALID_RESPONSE;
  return result;
}

const SoundAsset* AudioService::resolveAsset(const std::string& sound_id) const {
  const auto found = sound_manifest_.find(sound_id);
  if (found != sound_manifest_.end()) return &found->second;
  // Never turn an explicit but stale/invalid ID into a different sound. This
  // previously hid SD selection problems by trying /flash/sounds/default.wav.
  if (!sound_id.empty() && sound_id != "default") return nullptr;
  const auto fallback = sound_manifest_.find("default");
  return fallback == sound_manifest_.end() ? nullptr : &fallback->second;
}

const AudioProfile* AudioService::resolveProfile(const std::string& profile_id) const {
  const auto found = audio_profiles_.find(profile_id);
  if (found != audio_profiles_.end()) return &found->second;
  const auto fallback = audio_profiles_.find("sd-default");
  return fallback == audio_profiles_.end() ? nullptr : &fallback->second;
}

esp_err_t AudioService::playHttpWave(const SoundAsset& asset, const AudioProfile& profile, const RingRequest& request) {
  const std::string url = !asset.stream_url.empty() ? asset.stream_url : profile.endpoint;
  if (url.empty()) {
    ESP_LOGE(kTag, "No URL configured for asset '%s' on profile '%s'", asset.sound_id.c_str(), profile.profile_id.c_str());
    return ESP_ERR_INVALID_ARG;
  }

  esp_http_client_config_t config = {};
  config.url = url.c_str();
  config.method = HTTP_METHOD_GET;
  config.timeout_ms = app::config::kAudioHttpTimeoutMs;
  config.buffer_size = app::config::kAudioHttpReadBytes;
  config.buffer_size_tx = 1024;

  esp_http_client_handle_t client = esp_http_client_init(&config);
  if (client == nullptr) {
    return ESP_ERR_NO_MEM;
  }

  esp_err_t result = esp_http_client_open(client, 0);
  if (result != ESP_OK) {
    ESP_LOGE(kTag, "HTTP open failed for %s", url.c_str());
    esp_http_client_cleanup(client);
    return result;
  }

  std::vector<uint8_t> wave_probe;
  wave_probe.reserve(app::config::kWaveHeaderProbeBytes);
  std::vector<uint8_t> read_buffer(app::config::kAudioHttpReadBytes, 0);
  WaveFormat format;
  bool parsed_header = false;

  while (wave_probe.size() < app::config::kWaveHeaderProbeBytes) {
    const int bytes_read = esp_http_client_read(client, reinterpret_cast<char*>(read_buffer.data()), read_buffer.size());
    if (bytes_read < 0) {
      result = ESP_FAIL;
      break;
    }
    if (bytes_read == 0) break;

    wave_probe.insert(wave_probe.end(), read_buffer.begin(), read_buffer.begin() + bytes_read);
    result = parseWaveBuffer(wave_probe.data(), wave_probe.size(), &format);
    if (result == ESP_OK) {
      parsed_header = true;
      break;
    }
    if (result != ESP_ERR_INVALID_SIZE) break;
  }

  if (result == ESP_OK && !parsed_header) {
    result = ESP_ERR_INVALID_RESPONSE;
  }
  if (result != ESP_OK) {
    ESP_LOGE(kTag, "Unable to parse WAV header from %s", url.c_str());
    esp_http_client_close(client);
    esp_http_client_cleanup(client);
    return result;
  }
  if (!isCanonicalWaveFormat(format.audio_format, format.channels, format.sample_rate, format.bits_per_sample)) {
    ESP_LOGE(kTag, "URL/VPS WAV must be PCM 16-bit mono at 22050 Hz: %s", url.c_str());
    esp_http_client_close(client);
    esp_http_client_cleanup(client);
    return ESP_ERR_INVALID_RESPONSE;
  }

  uint32_t bytes_remaining = format.data_size;
  if (request.duration_seconds > 0) {
    const uint32_t bytes_per_second = format.sample_rate * format.channels * (format.bits_per_sample / 8U);
    const uint64_t duration_bytes = static_cast<uint64_t>(bytes_per_second) * request.duration_seconds;
    bytes_remaining = static_cast<uint32_t>(std::min<uint64_t>(bytes_remaining, duration_bytes));
  }

  uint8_t carry_byte = 0;
  bool has_carry = false;

  if (wave_probe.size() > format.data_offset) {
    const size_t buffered_data_bytes = wave_probe.size() - format.data_offset;
    const size_t initial_bytes = std::min<size_t>(buffered_data_bytes, bytes_remaining);
    result = writeCanonicalPcmBytes(
        pcm5102_,
        wave_probe.data() + format.data_offset,
        initial_bytes,
        volume_percent_,
        &carry_byte,
        &has_carry);
    if (result != ESP_OK) {
      esp_http_client_close(client);
      esp_http_client_cleanup(client);
      return result;
    }
    bytes_remaining -= static_cast<uint32_t>(initial_bytes);
  }

  while (bytes_remaining > 0) {
    const int bytes_read = esp_http_client_read(
        client,
        reinterpret_cast<char*>(read_buffer.data()),
        std::min<size_t>(read_buffer.size(), bytes_remaining));
    if (bytes_read < 0) {
      result = ESP_FAIL;
      break;
    }
    if (bytes_read == 0) {
      result = ESP_ERR_INVALID_RESPONSE;
      break;
    }

    result = writeCanonicalPcmBytes(
        pcm5102_,
        read_buffer.data(),
        static_cast<size_t>(bytes_read),
        volume_percent_,
        &carry_byte,
        &has_carry);
    if (result != ESP_OK) break;
    bytes_remaining -= static_cast<uint32_t>(bytes_read);
  }

  pcm5102_.stop();
  esp_http_client_close(client);
  esp_http_client_cleanup(client);
  return result;
}

esp_err_t AudioService::parseWaveBuffer(const uint8_t* data, size_t data_size, WaveFormat* format) const {
  if (data == nullptr || format == nullptr) return ESP_ERR_INVALID_ARG;
  if (data_size < 12) return ESP_ERR_INVALID_SIZE;
  if (std::memcmp(data, "RIFF", 4) != 0 || std::memcmp(data + 8, "WAVE", 4) != 0) return ESP_ERR_INVALID_RESPONSE;

  bool found_fmt = false;
  size_t offset = 12;
  while (offset + 8 <= data_size) {
    const uint8_t* chunk_header = data + offset;
    const uint32_t chunk_size = readLe32(chunk_header + 4);
    offset += 8;

    if (std::memcmp(chunk_header, "fmt ", 4) == 0) {
      if (chunk_size < 16) return ESP_ERR_INVALID_RESPONSE;
      if (offset + chunk_size > data_size) return ESP_ERR_INVALID_SIZE;

      format->audio_format = readLe16(data + offset + 0);
      format->channels = readLe16(data + offset + 2);
      format->sample_rate = readLe32(data + offset + 4);
      format->bits_per_sample = readLe16(data + offset + 14);
      found_fmt = true;
    } else if (std::memcmp(chunk_header, "data", 4) == 0) {
      format->data_offset = static_cast<uint32_t>(offset);
      format->data_size = chunk_size;
      return found_fmt ? ESP_OK : ESP_ERR_INVALID_RESPONSE;
    }

    if (offset + chunk_size > data_size) return ESP_ERR_INVALID_SIZE;
    offset += chunk_size;
    if ((chunk_size & 1U) != 0U) {
      if (offset >= data_size) return ESP_ERR_INVALID_SIZE;
      ++offset;
    }
  }

  return ESP_ERR_INVALID_SIZE;
}

esp_err_t AudioService::parseWaveFile(FILE* file, WaveFormat* format) const {
  if (file == nullptr || format == nullptr) return ESP_ERR_INVALID_ARG;

  uint8_t header[12] = {};
  if (std::fread(header, 1, sizeof(header), file) != sizeof(header)) return ESP_FAIL;
  if (std::memcmp(header, "RIFF", 4) != 0 || std::memcmp(header + 8, "WAVE", 4) != 0) return ESP_ERR_INVALID_RESPONSE;

  bool found_fmt = false;
  bool found_data = false;
  while (!found_data) {
    uint8_t chunk_header[8] = {};
    if (std::fread(chunk_header, 1, sizeof(chunk_header), file) != sizeof(chunk_header)) break;
    const uint32_t chunk_size = readLe32(chunk_header + 4);

    if (std::memcmp(chunk_header, "fmt ", 4) == 0) {
      std::vector<uint8_t> fmt_chunk(chunk_size, 0);
      if (std::fread(fmt_chunk.data(), 1, chunk_size, file) != chunk_size || chunk_size < 16) return ESP_FAIL;
      format->audio_format = readLe16(fmt_chunk.data() + 0);
      format->channels = readLe16(fmt_chunk.data() + 2);
      format->sample_rate = readLe32(fmt_chunk.data() + 4);
      format->bits_per_sample = readLe16(fmt_chunk.data() + 14);
      if ((chunk_size & 1U) != 0U) std::fseek(file, 1L, SEEK_CUR);
      found_fmt = true;
      continue;
    }

    if (std::memcmp(chunk_header, "data", 4) == 0) {
      format->data_offset = static_cast<uint32_t>(std::ftell(file));
      format->data_size = chunk_size;
      found_data = true;
      break;
    }

    std::fseek(file, static_cast<long>(chunk_size + (chunk_size & 1U)), SEEK_CUR);
  }

  return (found_fmt && found_data) ? ESP_OK : ESP_ERR_INVALID_RESPONSE;
}

}  // namespace app::services
