#pragma once

#include <cstdint>

namespace board {

inline constexpr uint8_t kRelayPin = 1;
inline constexpr uint8_t kRfLinePin = 5;
inline constexpr uint8_t kStatusLedPin = 3;
inline constexpr uint8_t kButtonPin = 4;

inline constexpr bool kRelayActiveHigh = true;
inline constexpr bool kLedActiveHigh = true;
inline constexpr bool kButtonActiveLow = true;

}  // namespace board
