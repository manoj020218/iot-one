#pragma once

#include <cstddef>
#include <cstdint>

#include "driver/i2s_std.h"
#include "esp_err.h"
#include "freertos/FreeRTOS.h"

namespace app::drivers {

class Pcm5102I2s {
 public:
  esp_err_t init();
  esp_err_t configureSampleRate(uint32_t sample_rate_hz);
  esp_err_t writeStereoFrames(const int16_t* interleaved_stereo_frames, size_t frame_count, TickType_t timeout = portMAX_DELAY);
  esp_err_t writePcm16(
      const int16_t* interleaved_samples,
      size_t frame_count,
      uint8_t channels,
      uint8_t volume_percent,
      TickType_t timeout = portMAX_DELAY);
  esp_err_t writeMonoSamplesDuplicated(const int16_t* mono_samples, size_t sample_count, uint8_t volume_percent, TickType_t timeout = portMAX_DELAY);
  esp_err_t playDiagnosticTone(uint32_t frequency_hz, uint32_t duration_ms, uint8_t volume_percent);
  void stop();
  bool isReady() const { return ready_; }

 private:
  i2s_chan_handle_t tx_handle_ = nullptr;
  bool ready_ = false;
  bool channel_enabled_ = false;
  uint32_t sample_rate_hz_ = 0;
};

}  // namespace app::drivers
