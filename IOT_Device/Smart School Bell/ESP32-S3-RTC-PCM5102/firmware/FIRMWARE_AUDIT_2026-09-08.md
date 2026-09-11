# Firmware Audit — 2026-09-08

## Result

The firmware is compile-valid and suitable for controlled bench bring-up. The
user has confirmed DS3231 read/write on the connected unit. It is not yet
field-ready because SDMMC audio playback, PCM5102/amplifier behavior, RTC
battery retention, and power-cut recovery still need complete physical tests.

## WebUI/API Extension

- added an always-available `JENIX-SCHOOL-BELL` WPA2 setup AP
- added a self-contained WebUI at `http://192.168.4.1/`
- added versioned API v1 with a machine-readable capabilities contract
- added school settings, NVS Wi-Fi persistence, RTC setting, validated schedule
  replacement, FAT32 formatting, streamed MP3/WAV upload, sound discovery, and
  manual bell testing
- recovery WebUI starts even when the SD card cannot mount
- checked extension image: 1,453,960 bytes flash (46.2%) and 40,832 bytes
  static RAM (12.5%)

### Bell-management extension (2026-09-09)

- firmware `0.3.0-bell-plans` exposes API v1.1 with 21 discoverable actions
- added regular/summer/winter/exam/custom schedule profiles, priority-based
  date rules, recurring cross-year season rules, holidays, bell presets,
  automatic-bell pause/resume, sound deletion safeguards, and log access
- the embedded WebUI remains a functional commissioning/control surface; the
  same API is intended for the future PWA/Android UX
- teacher planning, parent portal, class/subject/room allocation, cloud
  registration, and tunnel features are deliberately outside this firmware
- WebUI JavaScript, capability JSON, and sample SD JSON were syntax-validated
- host calendar/schedule boundary tests passed
- final compile-checked image: 1,484,504 bytes flash (47.2%), 40,832 bytes
  static RAM (12.5%); `firmware.bin` is 1,484,864 bytes with SHA-256
  `BA9CEEC4B1170794E4FD67C3AE2893B686B8D4E9D3CD6F029C34454E950CE828`

### Device-clock WebUI extension (2026-09-09)

- firmware `0.3.1-device-clock` adds an authoritative live ESP32/DS3231 clock
  to the WebUI and resynchronizes it with the device every 30 seconds
- `/api/v1/status` now formally advertises `local_time`, `unix_time`,
  `timezone`, `timezone_posix`, `local_date`, `weekday`, and `clock_source`
- firmware and WebUI explicitly identify device local time—not phone time—as
  the schedule-execution reference
- WebUI JavaScript and machine-readable capability JSON passed syntax checks
- final compile-checked image: 1,486,684 bytes flash (47.3%), 40,832 bytes
  static RAM (12.5%); `firmware.bin` is 1,487,056 bytes with SHA-256
  `CFD0607D83D3C672E403CDB180369D3AB9059979F5B53E16BC72306D864056E6`

### Bench flash verification (2026-09-09)

- flashed the compile-checked `0.3.0-bell-plans` image to the ESP32-S3 on
  `COM30`; esptool verified every written image hash and reset the board
- bootloader detected ESP32-S3 revision 0.2 with 16 MB flash and loaded the
  factory application successfully
- SDMMC 4-bit initialization failed on the connected hardware, then the
  firmware's 1-bit fallback mounted the card successfully
- DS3231 supplied valid local time (`2026-09-09 13:51:43` in the captured boot
  log), and runtime reached `Firmware ready`
- setup AP started as `JENIX-SCHOOL-BELL`; DHCP/WebUI address is `192.168.4.1`
- `device.json` was not present on the inserted card, so default school settings
  remain active until saved through WebUI/API

## Verified in This Audit

- inspected the supplied EdgeHex ESP32-S3-WROOM-1 N16R8 pinout PDF
- checked all 68 source audio files with FFprobe: 67 valid MP3 Layer III files
  and one valid PCM WAV file
- confirmed the MP3 collection contains mono/stereo audio at 24, 44.1, and
  48 kHz; the WAV is unsigned 8-bit, mono, 22050 Hz
- compiled with PlatformIO, ESP-IDF 5.3.1, and Espressif
  `esp_audio_codec` 2.6.2
- final checked image before hardware testing: 1,422,988 bytes flash (45.2%)
  and 40,832 bytes static RAM (12.5%)
- backend unit tests: 3 passed

## Corrected During This Audit

- regrouped PCM5102 signals onto adjacent left-header pins GPIO18/17/16
- regrouped DS3231 signals onto right-header pins GPIO47/21/2
- added direct SD-card MP3 decoding and dynamic I2S sample-rate selection
- added mono/stereo volume handling and 8/16-bit PCM WAV playback
- enabled FAT long filenames and UTF-8 paths for the supplied filenames
- serialized playback so automatic and web requests cannot drive I2S together
- increased decoder-capable task stacks and limited unused codecs
- added duration/body bounds and complete HTTP request-body reads
- made SD/HTTP playback propagate read and I2S write failures
- added `tools/prepare_sd_card.ps1` to copy the bell library and generate its
  manifest without renaming the source files

## Open High-Risk Items

1. Hardware validation is still mandatory. Pin suitability is verified from
   the pinout and ESP32-S3 GPIO rules, but electrical wiring has not been
   measured or played through the actual PCM5102/amplifier.
2. RTC recovery is available from WebUI/API and persists to DS3231. The user
   reported a valid RTC after saving it on the connected bench unit; battery
   retention after a long power-off still needs a physical test.
3. Schedule execution markers are RAM-only. A reset within a ringing minute can
   repeat a bell, while long blocking playback can cause a closely following
   schedule to be missed.
4. The LAN manual-ring endpoint has no authentication. It must not be exposed
   outside a trusted installation network.
5. Sync, provisioning, factory reset, persistent missed-bell recovery, log
   rotation, and OTA remain placeholders or incomplete.
6. I2S uses ESP-IDF's legacy API. It compiles on IDF 5.3.1 but emits deprecation
   warnings and should be migrated before a future major IDF upgrade.

## Hardware-Side Notes

- DS3231: use 3.3 V so breakout-board I2C pull-ups cannot apply 5 V to GPIO.
- PCM5102 module: use the module's specified clean 5 V supply and common logic
  ground; do not connect speakers directly to its line output.
- The regrouped RTC mapping uses header GPIOs, not the board's fixed onboard I2C
  connector. If that connector is used, its actual hardwired GPIO pair must be
  verified before changing the harness.
- Format the 32 GB card as FAT32, not exFAT.
- Do not flash until the user has connected the ESP32-S3 by USB and explicitly
  confirmed readiness.
