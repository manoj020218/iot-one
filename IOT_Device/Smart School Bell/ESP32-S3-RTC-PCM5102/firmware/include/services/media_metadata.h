#pragma once

#include <cstdint>
#include <string>

#include "esp_err.h"

namespace app::services {

// Reads the encoded media duration without decoding audio. MP3 duration is
// calculated by walking every valid frame, so variable-bit-rate files are
// handled correctly.
esp_err_t readMediaDurationMs(const std::string& path, const std::string& extension,
                              uint64_t* duration_ms);

}  // namespace app::services
