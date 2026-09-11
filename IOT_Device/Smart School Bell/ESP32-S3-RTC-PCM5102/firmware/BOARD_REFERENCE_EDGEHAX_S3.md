# EdgeHex S3 Board Reference

Last updated: 2026-09-08

This file records the EdgeHex ESP32-S3-WROOM-1 N16R8 board baseline adopted
for the school-bell firmware.

Source references:
- copied PDF: `../ESP32-S3-WROOM-N16R8-Pinout.pdf`
- FloodGuard firmware using the same board family
- final bell wiring: `WIRING_EDGEHAX_S3_DS3231_PCM5102.md`

## Board Facts

- module: `ESP32-S3-WROOM-1 N16R8`
- flash: `16MB`
- PSRAM: `8MB OPI`
- onboard microSD slot present
- onboard button and three LEDs present

## Do Not Use

- `GPIO33` to `GPIO37`: occupied by OPI PSRAM
- `GPIO4`: documented short-to-GND issue on the FloodGuard board variant

## Adopted Board-Level Pins

- status LED: `GPIO42` (green)
- extra LEDs: `GPIO40` orange, `GPIO41` white
- service button: `GPIO48`
- school-bell RTC SDA: `GPIO47` (right header)
- school-bell RTC SCL: `GPIO21` (right header)

## Onboard SDMMC Pins

- `CLK = GPIO12`
- `CMD = GPIO11`
- `D0  = GPIO13`
- `D1  = GPIO14`
- `D2  = GPIO9`
- `D3  = GPIO10`
- card detect: none

The school-bell firmware should use `SDMMC`, not `SDSPI`, for the onboard card.

## Locked School-Bell Peripheral Pins

- PCM5102 `BCLK = GPIO17`
- PCM5102 `LRCLK = GPIO18`
- PCM5102 `DIN = GPIO16` (ESP32 I2S data output)
- DS3231 `SDA = GPIO47`
- DS3231 `SCL = GPIO21`
- DS3231 `SQW/INT = GPIO2` optional

This intentionally keeps PCM5102 signals on the left header and DS3231 signals
on the right header. These assignments are the school-bell build baseline
unless the physical carrier PCB proves otherwise during bench bring-up.
