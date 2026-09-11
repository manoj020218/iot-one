# EdgeHex S3 School Bell Wiring

Last updated: 2026-09-08

This file is the physical wiring source of truth for the school-bell build that
uses the same EdgeHex board family as the FloodGuard hardware.

## Product Modules

- MCU board: `EdgeHex ESP32-S3-WROOM-1 N16R8`
- DAC board: `GY-PCM5102 / PCM5102A` style I2S DAC
- RTC board: `DS3231` I2C module with backup coin cell

## Non-Negotiable Electrical Rules

- run the `DS3231` module at `3.3V`, not `5V`
- power the `PCM5102` module from a clean `5V` rail
- keep all ESP32-S3 signal pins at `3.3V` logic only
- keep I2S wires short; target `<= 10 cm` inside the box
- do not use `GPIO4` or `GPIO33` to `GPIO37`
- do not share noisy amplifier power return as the only logic ground path

## Locked ESP32-S3 Pin Map

These pins are now reserved for school-bell hardware:

- `GPIO47` -> DS3231 `SDA` (right header)
- `GPIO21` -> DS3231 `SCL` (right header)
- `GPIO2` -> DS3231 `SQW/INT` optional (right header)
- `GPIO17` -> PCM5102 `BCK`
- `GPIO18` -> PCM5102 `LCK` / `LRCK` / `WS`
- `GPIO16` -> PCM5102 `DIN`
- `GPIO48` -> service/config button
- `GPIO42` -> main status LED
- `GPIO40` -> orange LED
- `GPIO41` -> white LED
- `GPIO9/10/11/12/13/14` -> onboard SDMMC, do not reuse

## DS3231 Wiring

Use these exact connections:

| EdgeHex | DS3231 module | Notes |
|---|---|---|
| `3.3V` | `VCC` | mandatory at 3.3V to keep I2C pull-ups safe |
| `GND` | `GND` | common logic ground |
| `GPIO47` | `SDA` | I2C data |
| `GPIO21` | `SCL` | I2C clock; adjacent to GPIO47 on right header |
| `GPIO2` | `SQW` or `INT/SQW` | optional; leave open if RTC interrupt is not used |
| `NC` | `32K` | leave open |
| `NC` | `RST` | leave open unless a later reset design needs it |

### DS3231 Safety Note

Many DS3231 breakout boards pull `SDA` and `SCL` up to their own `VCC`.
Because ESP32-S3 IO is `3.3V`, feeding the module with `5V` can force `5V`
onto the I2C lines. For this product, wire the module at `3.3V` only.

## PCM5102 Wiring

Use these exact digital connections:

| EdgeHex | PCM5102 module | Notes |
|---|---|---|
| `5V` | `VCC` | module product page lists 5V supply |
| `GND` | `GND` | common ground with ESP32 and amplifier |
| `GPIO17` | `BCK` | I2S bit clock |
| `GPIO18` | `LCK` / `LRCK` / `WS` | I2S left-right clock |
| `GPIO16` | `DIN` | I2S serial audio data from ESP32 |
| `GND` | `SCK` / `MCLK` | tie low; this matches the proven working PCM5102 module configuration and prevents a floating clock input |

For the GY-PCM5102 module already proven with the C3 test firmware, use the
same solder-pad configuration: `H1=L`, `H2=L`, `H3=H`, `H4=L`.

### PCM5102 Analog Out

- use the module `3.5mm stereo output` to the amplifier `AUX IN`
- if a panel socket is used instead of the onboard jack, wire `L`, `R`, and
  `GND` one-to-one from the DAC output to the panel socket
- do not connect speaker terminals directly to the PCM5102 output

## Mechanical and Noise Rules

- mount the PCM5102 away from high-current relay or amplifier power wiring
- twist `GND` with the three I2S signal wires if using loose wires
- keep the RTC battery accessible for service
- use proper crimped connectors or soldered headers, not temporary jumper wires
- if the amplifier and logic supply come from one SMPS, use a star-ground layout

## Firmware Alignment

The firmware header must match this wiring:

- `include/board_pins.h`
- `kRtcSda = GPIO47`
- `kRtcScl = GPIO21`
- `kRtcSqwInt = GPIO2`
- `kI2sBclk = GPIO17`
- `kI2sLrclk = GPIO18`
- `kI2sDout = GPIO16`

## Why These Pins

- `GPIO18`, `GPIO17`, and `GPIO16` are three adjacent pins on the left header,
  so the PCM5102 harness does not cross the board
- `GPIO21`, `GPIO47`, and optional `GPIO2` are all on the right header, so the
  DS3231 harness remains on the opposite side
- the map stays clear of onboard SDMMC, OPI PSRAM, USB, LEDs, the service
  button, strapping pins, and the known `GPIO4` board fault

## Bring-Up Checklist

1. verify `3.3V` on DS3231 `VCC`
2. verify `5V` on PCM5102 `VCC`
3. verify PCM5102 `SCK` is tied to `GND`
4. confirm PCM5102 pads are `H1=L`, `H2=L`, `H3=H`, `H4=L`
5. confirm shared ground between EdgeHex, DS3231, PCM5102, and amplifier
6. confirm SD card mounts before testing audio
7. confirm RTC time read/write before enabling automatic ringing
8. confirm WAV playback on AUX before field install

## Source Inputs

- local board reference: `BOARD_REFERENCE_EDGEHAX_S3.md`
- copied board PDF: `../ESP32-S3-WROOM-N16R8-Pinout.pdf`
- PCM5102 vendor page: Hubtronics product page
- DS3231 vendor page: KTRON product page
- chip behavior reference: TI `PCM5102A` product documentation
