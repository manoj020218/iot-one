#include "drivers/pcm5102_i2s.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <vector>

#include "app_config.h"
#include "board_pins.h"
#include "esp_check.h"
#include "esp_log.h"
#include "freertos/task.h"

namespace app::drivers {

namespace {
constexpr char kTag[] = "Pcm5102I2s";
constexpr double kTwoPi = 6.28318530717958647692;
}

esp_err_t Pcm5102I2s::init() {
  if (board::kI2sBclk == GPIO_NUM_NC || board::kI2sLrclk == GPIO_NUM_NC || board::kI2sDout == GPIO_NUM_NC) {
    ESP_LOGW(kTag, "PCM5102 pins unresolved in board_pins.h");
    ready_ = false;
    return ESP_ERR_INVALID_STATE;
  }

  i2s_chan_config_t channel_config = I2S_CHANNEL_DEFAULT_CONFIG(board::kI2sPort, I2S_ROLE_MASTER);
  ESP_RETURN_ON_ERROR(i2s_new_channel(&channel_config, &tx_handle_, nullptr), kTag, "i2s channel create failed");

  i2s_std_config_t standard_config = {};
  standard_config.clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(app::config::kCanonicalSampleRate);
  standard_config.slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(
      I2S_DATA_BIT_WIDTH_16BIT,
      I2S_SLOT_MODE_STEREO);
  standard_config.slot_cfg.slot_mask = I2S_STD_SLOT_BOTH;
  standard_config.gpio_cfg.mclk = I2S_GPIO_UNUSED;
  standard_config.gpio_cfg.bclk = board::kI2sBclk;
  standard_config.gpio_cfg.ws = board::kI2sLrclk;
  standard_config.gpio_cfg.dout = board::kI2sDout;
  standard_config.gpio_cfg.din = I2S_GPIO_UNUSED;
  standard_config.gpio_cfg.invert_flags = {};

  const esp_err_t result = i2s_channel_init_std_mode(tx_handle_, &standard_config);
  if (result != ESP_OK) {
    i2s_del_channel(tx_handle_);
    tx_handle_ = nullptr;
    return result;
  }
  ready_ = true;
  channel_enabled_ = false;
  sample_rate_hz_ = app::config::kCanonicalSampleRate;
  ESP_LOGI(kTag, "Standard Philips I2S ready: BCK=GPIO%d, LRCK=GPIO%d, DIN=GPIO%d",
           board::kI2sBclk, board::kI2sLrclk, board::kI2sDout);
  return ESP_OK;
}

esp_err_t Pcm5102I2s::configureSampleRate(uint32_t sample_rate_hz) {
  if (!ready_ || sample_rate_hz < 8000 || sample_rate_hz > 96000) {
    return ESP_ERR_INVALID_ARG;
  }
  if (sample_rate_hz_ != sample_rate_hz) {
    if (channel_enabled_) {
      ESP_RETURN_ON_ERROR(i2s_channel_disable(tx_handle_), kTag, "i2s channel disable failed");
      channel_enabled_ = false;
    }
    i2s_std_clk_config_t clock_config = I2S_STD_CLK_DEFAULT_CONFIG(sample_rate_hz);
    ESP_RETURN_ON_ERROR(
        i2s_channel_reconfig_std_clock(tx_handle_, &clock_config),
        kTag,
        "i2s clock reconfiguration failed");
    sample_rate_hz_ = sample_rate_hz;
  }

  if (!channel_enabled_) {
    ESP_RETURN_ON_ERROR(i2s_channel_enable(tx_handle_), kTag, "i2s channel enable failed");
    channel_enabled_ = true;
  }
  return ESP_OK;
}

esp_err_t Pcm5102I2s::writeStereoFrames(const int16_t* interleaved_stereo_frames, size_t frame_count, TickType_t timeout) {
  if (!ready_ || !channel_enabled_ || interleaved_stereo_frames == nullptr || frame_count == 0) {
    return ESP_ERR_INVALID_STATE;
  }

  size_t bytes_written = 0;
  const size_t bytes_requested = frame_count * sizeof(int16_t) * 2;
  const uint32_t timeout_ms = timeout == portMAX_DELAY ? portMAX_DELAY : pdTICKS_TO_MS(timeout);
  const esp_err_t result = i2s_channel_write(
      tx_handle_,
      interleaved_stereo_frames,
      bytes_requested,
      &bytes_written,
      timeout_ms);
  if (result != ESP_OK) return result;
  return bytes_written == bytes_requested ? ESP_OK : ESP_ERR_TIMEOUT;
}

esp_err_t Pcm5102I2s::writeMonoSamplesDuplicated(const int16_t* mono_samples, size_t sample_count, uint8_t volume_percent, TickType_t timeout) {
  return writePcm16(mono_samples, sample_count, 1, volume_percent, timeout);
}

esp_err_t Pcm5102I2s::writePcm16(
    const int16_t* interleaved_samples,
    size_t frame_count,
    uint8_t channels,
    uint8_t volume_percent,
    TickType_t timeout) {
  if (!ready_ || interleaved_samples == nullptr || frame_count == 0 || (channels != 1 && channels != 2)) {
    return ESP_ERR_INVALID_STATE;
  }

  std::vector<int16_t> stereo_frames(frame_count * 2, 0);
  const int32_t scale = std::clamp<int>(volume_percent, 0, 100);

  for (size_t frame = 0; frame < frame_count; ++frame) {
    for (size_t channel = 0; channel < 2; ++channel) {
      const size_t source_channel = channels == 1 ? 0 : channel;
      const int32_t scaled = static_cast<int32_t>(interleaved_samples[(frame * channels) + source_channel]) * scale / 100;
      stereo_frames[(frame * 2) + channel] =
          static_cast<int16_t>(std::clamp<int32_t>(scaled, -32768, 32767));
    }
  }

  return writeStereoFrames(stereo_frames.data(), frame_count, timeout);
}

esp_err_t Pcm5102I2s::playDiagnosticTone(uint32_t frequency_hz, uint32_t duration_ms, uint8_t volume_percent) {
  if (!ready_) {
    return ESP_ERR_INVALID_STATE;
  }

  const uint32_t sample_rate = app::config::kCanonicalSampleRate;
  const size_t sample_count = static_cast<size_t>((static_cast<uint64_t>(sample_rate) * duration_ms) / 1000);
  constexpr size_t kToneChunkSamples = 256;
  std::array<int16_t, kToneChunkSamples> mono_buffer = {};
  size_t generated = 0;

  while (generated < sample_count) {
    const size_t chunk_samples = std::min(kToneChunkSamples, sample_count - generated);
    for (size_t i = 0; i < chunk_samples; ++i) {
      const double phase = (static_cast<double>(generated + i) * static_cast<double>(frequency_hz) * kTwoPi) /
                           static_cast<double>(sample_rate);
      mono_buffer[i] = static_cast<int16_t>(std::sin(phase) * 12000.0);
    }
    const esp_err_t result = writeMonoSamplesDuplicated(mono_buffer.data(), chunk_samples, volume_percent);
    if (result != ESP_OK) return result;
    generated += chunk_samples;
  }
  return ESP_OK;
}

void Pcm5102I2s::stop() {
  if (!ready_ || !channel_enabled_) {
    return;
  }

  // Queue silence before the final audio DMA data drains. Leaving an enabled
  // TX channel without queued samples can underrun and put loud garbage on the
  // PCM5102 output. Eight small buffers provide a clean tail without a large
  // temporary allocation.
  std::array<int16_t, 512> silence = {};
  constexpr size_t kSilenceChunks = 8;
  for (size_t chunk = 0; chunk < kSilenceChunks; ++chunk) {
    const esp_err_t write_result = writeStereoFrames(silence.data(), silence.size() / 2, pdMS_TO_TICKS(250));
    if (write_result != ESP_OK) {
      ESP_LOGW(kTag, "Unable to queue shutdown silence: %s", esp_err_to_name(write_result));
      break;
    }
  }

  const uint32_t silence_frames = static_cast<uint32_t>(kSilenceChunks * (silence.size() / 2));
  const uint32_t drain_ms = sample_rate_hz_ > 0
                                ? ((silence_frames * 1000U) / sample_rate_hz_) + 20U
                                : 120U;
  vTaskDelay(pdMS_TO_TICKS(drain_ms));

  const esp_err_t disable_result = i2s_channel_disable(tx_handle_);
  if (disable_result != ESP_OK) {
    ESP_LOGW(kTag, "Unable to disable I2S after playback: %s", esp_err_to_name(disable_result));
    return;
  }
  channel_enabled_ = false;
}

}  // namespace app::drivers
