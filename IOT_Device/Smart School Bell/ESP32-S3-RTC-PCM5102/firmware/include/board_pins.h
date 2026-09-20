#pragma once

#include "driver/gpio.h"
#include "driver/i2c.h"
#include "driver/i2s_types.h"
#include "hal/adc_types.h"

namespace board {

// EdgeHex ESP32-S3-WROOM-1 N16R8 baseline verified against the copied board
// pinout PDF. External peripheral signals are intentionally split by header:
// DS3231 on the right-hand header and PCM5102 on three adjacent left-hand pins.

// Product front-panel pair on adjacent left-header pins. The button input is
// active-low (switch to GND, internal pull-up enabled). kStatusLed is the data
// line for one external WS2812/NeoPixel, not a conventional two-pin LED.
inline constexpr gpio_num_t kResetButton = GPIO_NUM_5;
inline constexpr gpio_num_t kStatusLed = GPIO_NUM_6;
inline constexpr gpio_num_t kServiceButton = kResetButton;
inline constexpr gpio_num_t kManualRingButton = GPIO_NUM_NC;

// GPIO33-37 are occupied by OPI PSRAM on N16R8 and must never be reused.
// GPIO4 is blocked on the FloodGuard board variant due to a PCB/socket short.

inline constexpr i2c_port_t kRtcI2cPort = I2C_NUM_0;
inline constexpr gpio_num_t kRtcSda = GPIO_NUM_47;
inline constexpr gpio_num_t kRtcScl = GPIO_NUM_21;
inline constexpr gpio_num_t kRtcSqwInt = GPIO_NUM_2;
inline constexpr uint32_t kRtcI2cClockHz = 100000;

inline constexpr gpio_num_t kSdClk = GPIO_NUM_12;
inline constexpr gpio_num_t kSdCmd = GPIO_NUM_11;
inline constexpr gpio_num_t kSdD0 = GPIO_NUM_13;
inline constexpr gpio_num_t kSdD1 = GPIO_NUM_14;
inline constexpr gpio_num_t kSdD2 = GPIO_NUM_9;
inline constexpr gpio_num_t kSdD3 = GPIO_NUM_10;
inline constexpr gpio_num_t kSdCardDetect = GPIO_NUM_NC;
inline constexpr int kSdBusWidth = 4;

inline constexpr i2s_port_t kI2sPort = I2S_NUM_0;
inline constexpr gpio_num_t kI2sBclk = GPIO_NUM_17;
inline constexpr gpio_num_t kI2sLrclk = GPIO_NUM_18;
inline constexpr gpio_num_t kI2sDout = GPIO_NUM_16;

// Physical push-to-talk announcement input. Both pins are adjacent on the
// left-hand header, immediately below the PCM5102 signals. GPIO7 is ADC1_CH6,
// so continuous microphone capture remains independent of the Wi-Fi radio.
inline constexpr gpio_num_t kAnnouncementPtt = GPIO_NUM_15;
inline constexpr gpio_num_t kAnnouncementMicAdc = GPIO_NUM_7;
inline constexpr adc_unit_t kAnnouncementMicAdcUnit = ADC_UNIT_1;
inline constexpr adc_channel_t kAnnouncementMicAdcChannel = ADC_CHANNEL_6;

}  // namespace board
