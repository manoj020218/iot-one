#pragma once

#include <cstddef>
#include <cstdint>

namespace app::utils {

uint32_t crc32(const uint8_t* data, size_t length);

}  // namespace app::utils
