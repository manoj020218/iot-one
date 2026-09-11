#include "services/media_metadata.h"

#include <array>
#include <cstdio>
#include <cstring>

namespace app::services {

namespace {

uint32_t readLe32(const uint8_t* p) {
  return static_cast<uint32_t>(p[0]) | (static_cast<uint32_t>(p[1]) << 8) |
         (static_cast<uint32_t>(p[2]) << 16) | (static_cast<uint32_t>(p[3]) << 24);
}

esp_err_t readWaveDuration(FILE* file, uint64_t* duration_ms) {
  std::array<uint8_t, 12> header{};
  if (std::fread(header.data(), 1, header.size(), file) != header.size() ||
      std::memcmp(header.data(), "RIFF", 4) != 0 ||
      std::memcmp(header.data() + 8, "WAVE", 4) != 0) {
    return ESP_ERR_INVALID_RESPONSE;
  }

  uint32_t byte_rate = 0;
  uint32_t data_size = 0;
  while (!std::feof(file)) {
    std::array<uint8_t, 8> chunk{};
    if (std::fread(chunk.data(), 1, chunk.size(), file) != chunk.size()) break;
    const uint32_t size = readLe32(chunk.data() + 4);
    if (std::memcmp(chunk.data(), "fmt ", 4) == 0) {
      std::array<uint8_t, 16> format{};
      if (size < format.size() || std::fread(format.data(), 1, format.size(), file) != format.size()) {
        return ESP_ERR_INVALID_RESPONSE;
      }
      byte_rate = readLe32(format.data() + 8);
      if (size > format.size() && std::fseek(file, static_cast<long>(size - format.size()), SEEK_CUR) != 0) {
        return ESP_FAIL;
      }
    } else if (std::memcmp(chunk.data(), "data", 4) == 0) {
      data_size = size;
      break;
    } else if (std::fseek(file, static_cast<long>(size), SEEK_CUR) != 0) {
      return ESP_FAIL;
    }
    if ((size & 1U) != 0 && std::fseek(file, 1, SEEK_CUR) != 0) return ESP_FAIL;
  }
  if (byte_rate == 0 || data_size == 0) return ESP_ERR_INVALID_RESPONSE;
  *duration_ms = (static_cast<uint64_t>(data_size) * 1000ULL + byte_rate / 2U) / byte_rate;
  return ESP_OK;
}

bool parseMp3FrameHeader(const uint8_t* p, uint32_t* frame_length,
                         uint32_t* sample_rate, uint16_t* samples_per_frame) {
  if (p[0] != 0xff || (p[1] & 0xe0) != 0xe0) return false;
  const uint8_t version_bits = (p[1] >> 3) & 0x03;
  const uint8_t layer_bits = (p[1] >> 1) & 0x03;
  const uint8_t bitrate_index = (p[2] >> 4) & 0x0f;
  const uint8_t sample_index = (p[2] >> 2) & 0x03;
  if (version_bits == 1 || layer_bits != 1 || bitrate_index == 0 ||
      bitrate_index == 15 || sample_index == 3) return false;

  static constexpr uint16_t kMpeg1Layer3Kbps[16] = {
      0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0};
  static constexpr uint16_t kMpeg2Layer3Kbps[16] = {
      0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0};
  static constexpr uint32_t kBaseRates[3] = {44100, 48000, 32000};

  const bool mpeg1 = version_bits == 3;
  uint32_t rate = kBaseRates[sample_index];
  if (version_bits == 2) rate /= 2;
  if (version_bits == 0) rate /= 4;
  const uint32_t kbps = mpeg1 ? kMpeg1Layer3Kbps[bitrate_index]
                              : kMpeg2Layer3Kbps[bitrate_index];
  const uint32_t padding = (p[2] >> 1) & 0x01;
  const uint32_t length = (mpeg1 ? 144000U : 72000U) * kbps / rate + padding;
  if (length < 24) return false;
  *frame_length = length;
  *sample_rate = rate;
  *samples_per_frame = mpeg1 ? 1152 : 576;
  return true;
}

esp_err_t readMp3Duration(FILE* file, uint64_t* duration_ms) {
  std::array<uint8_t, 10> id3{};
  if (std::fread(id3.data(), 1, id3.size(), file) != id3.size()) return ESP_ERR_INVALID_SIZE;
  if (std::memcmp(id3.data(), "ID3", 3) == 0) {
    const uint32_t tag_size = (static_cast<uint32_t>(id3[6] & 0x7f) << 21) |
                              (static_cast<uint32_t>(id3[7] & 0x7f) << 14) |
                              (static_cast<uint32_t>(id3[8] & 0x7f) << 7) |
                              static_cast<uint32_t>(id3[9] & 0x7f);
    if (std::fseek(file, static_cast<long>(tag_size + ((id3[5] & 0x10) ? 10 : 0)), SEEK_CUR) != 0) {
      return ESP_FAIL;
    }
  } else {
    std::rewind(file);
  }

  uint64_t total_microseconds = 0;
  uint32_t frames = 0;
  std::array<uint8_t, 4> header{};
  while (std::fread(header.data(), 1, header.size(), file) == header.size()) {
    uint32_t frame_length = 0;
    uint32_t sample_rate = 0;
    uint16_t samples = 0;
    if (!parseMp3FrameHeader(header.data(), &frame_length, &sample_rate, &samples)) {
      if (std::fseek(file, -3, SEEK_CUR) != 0) break;
      continue;
    }
    total_microseconds += (static_cast<uint64_t>(samples) * 1000000ULL) / sample_rate;
    ++frames;
    if (std::fseek(file, static_cast<long>(frame_length - header.size()), SEEK_CUR) != 0) break;
  }
  if (frames == 0) return ESP_ERR_INVALID_RESPONSE;
  *duration_ms = (total_microseconds + 500ULL) / 1000ULL;
  return ESP_OK;
}

}  // namespace

esp_err_t readMediaDurationMs(const std::string& path, const std::string& extension,
                              uint64_t* duration_ms) {
  if (duration_ms == nullptr) return ESP_ERR_INVALID_ARG;
  *duration_ms = 0;
  FILE* file = std::fopen(path.c_str(), "rb");
  if (file == nullptr) return ESP_ERR_NOT_FOUND;
  const esp_err_t result = extension == "wav" ? readWaveDuration(file, duration_ms)
                                                : extension == "mp3" ? readMp3Duration(file, duration_ms)
                                                                     : ESP_ERR_NOT_SUPPORTED;
  std::fclose(file);
  return result;
}

}  // namespace app::services
