#include "utils/crc_utils.h"

namespace app::utils {

uint32_t crc32(const uint8_t* data, size_t length) {
  uint32_t crc = 0xFFFFFFFFu;
  for (size_t i = 0; i < length; ++i) {
    crc ^= static_cast<uint32_t>(data[i]);
    for (int bit = 0; bit < 8; ++bit) {
      const uint32_t mask = static_cast<uint32_t>(-(static_cast<int32_t>(crc & 1u)));
      crc = (crc >> 1u) ^ (0xEDB88320u & mask);
    }
  }
  return ~crc;
}

}  // namespace app::utils
