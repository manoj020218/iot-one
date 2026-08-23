Import("env")

import os
import re
from pathlib import Path


PRIVATE_ARDUINO_COPY_MARKER = "qrunlock-prov2"
PRIVATE_ARDUINO_COPY_DIRNAME = (
    "framework-arduinoespressif32-3.20017.241212+sha.dcc1105b-qrunlock-prov2"
)
LEGACY_PRIVATE_ARDUINO_COPY_DIRNAME = (
    "framework-arduinoespressif32@3.20017.241212+sha.dcc1105b-qrunlock-prov2"
)


def _replace_once(path, before, after, description):
    text = path.read_text(encoding="utf-8")
    if after in text:
        return
    if before not in text:
        raise RuntimeError(f"Couldn't find expected text for {description}: {path}")
    path.write_text(text.replace(before, after, 1), encoding="utf-8")


def _replace_if_present(path, before, after):
    text = path.read_text(encoding="utf-8")
    if before not in text:
        return
    path.write_text(text.replace(before, after), encoding="utf-8")


def _replace_regex_if_present(path, pattern, replacement):
    text = path.read_text(encoding="utf-8")
    updated, count = re.subn(pattern, replacement, text)
    if count:
        path.write_text(updated, encoding="utf-8")


def _ensure_spiram_include_dir(path):
    text = path.read_text(encoding="utf-8")
    desired = (
        "set(includedirs\n"
        "  variants/${CONFIG_ARDUINO_VARIANT}/\n"
        "  cores/esp32/\n"
        f"  tools/sdk/{arduino_variant}/include/esp_hw_support/include/soc\n"
    )
    original = (
        "set(includedirs\n"
        "  variants/${CONFIG_ARDUINO_VARIANT}/\n"
        "  cores/esp32/\n"
    )
    if desired in text:
        return
    if original not in text:
        raise RuntimeError(f"Couldn't find expected include block in {path}")
    path.write_text(text.replace(original, desired, 1), encoding="utf-8")


def _require_private_arduino_copy(path):
    package_dir_name = path.name
    if package_dir_name == "framework-arduinoespressif32":
        raise RuntimeError(
            "prov2 bootstrap resolved the shared framework-arduinoespressif32 "
            f"package at {path}. Refusing to patch the shipping framework in "
            "place. Keep esp32-c3-supermini-prov2 pointed at the private "
            "framework-arduinoespressif32-...-qrunlock-prov2 copy via "
            "platform_packages."
        )
    if (
        not package_dir_name.startswith("framework-arduinoespressif32")
        or PRIVATE_ARDUINO_COPY_MARKER not in package_dir_name
    ):
        raise RuntimeError(
            "prov2 bootstrap resolved an unexpected Arduino framework package "
            f"directory: {path}. Expected a private, versioned prov2-only "
            "copy with a qrunlock-prov2 marker in the directory name."
        )


def _exclude_unused_source_file(path, reason):
    # Same technique as _exclude_unused_library, scoped to one file inside
    # an otherwise-needed library (e.g. Update/src/Updater.cpp is required,
    # but its sibling Update/src/HttpsOTAUpdate.cpp is a separate, unused
    # convenience wrapper that doesn't compile under IDF 5.3.1).
    if not path.is_file():
        return
    if path.read_text(encoding="utf-8").strip():
        path.write_text(
            f"// Emptied by prov2_espidf5_bootstrap.py — {reason}\n",
            encoding="utf-8",
        )


def _exclude_unused_library(arduino_dir, library_name):
    # lib_ignore has NO effect on this mixed arduino+espidf build path
    # (confirmed by testing: AsyncUDP still compiled and failed identically
    # with lib_ignore = AsyncUDP set) — library discovery here goes through
    # ESP-IDF's own component/CMake mechanism, not PlatformIO's classic LDF.
    #
    # Renaming the whole library folder out of the way does NOT work either
    # (confirmed by testing): the private copy's own generated CMakeLists.txt
    # hardcodes `libraries/<name>/src` as an idf_component_register
    # INCLUDE_DIRS entry, so CMake fails with "Include directory ... is not
    # a directory" once the folder is gone.
    #
    # Instead: keep the directory (and its header) in place so that
    # INCLUDE_DIRS check keeps passing, but empty out the .cpp source files
    # so there's nothing left to actually compile. Safe precisely because
    # this is a private, isolated copy, not the shared package other envs
    # depend on — nothing in QRunlock's own src/ or main/ includes this
    # library's header, so an empty implementation is never linked against.
    library_src_dir = arduino_dir / "libraries" / library_name / "src"
    if not library_src_dir.is_dir():
        return
    for suffix in (".cpp", ".c"):
        for source_file in library_src_dir.glob(f"*{suffix}"):
            if source_file.read_text(encoding="utf-8").strip():
                source_file.write_text(
                    f"// Emptied by prov2_espidf5_bootstrap.py — {library_name} is "
                    "unused by QRunlock and does not compile under IDF 5.3.1.\n",
                    encoding="utf-8",
                )


def _resolve_private_arduino_dir(default_arduino_dir):
    packages_dir = default_arduino_dir.parent
    private_dir = packages_dir / PRIVATE_ARDUINO_COPY_DIRNAME
    legacy_private_dir = packages_dir / LEGACY_PRIVATE_ARDUINO_COPY_DIRNAME
    if not private_dir.is_dir() and legacy_private_dir.is_dir():
        legacy_private_dir.rename(private_dir)
    return private_dir


def _override_platform_package_dir(platform, arduino_dir):
    # `pre:` extra scripts run before the platform build script itself, so this
    # intercepts the same lookup later used by espressif32's espidf.py.
    original_get_package_dir = platform.get_package_dir

    def _get_package_dir(name):
        if name == "framework-arduinoespressif32":
            return str(arduino_dir)
        return original_get_package_dir(name)

    platform.get_package_dir = _get_package_dir


platform = env.PioPlatform()
# platform.get_package_dir("framework-arduinoespressif32") is NOT safe to use
# here: PlatformBase.get_package_spec() builds its spec purely from
# self.packages[name] (the platform's static platform.json manifest) and
# never consults this env's `platform_packages` override at all — confirmed
# by reading PlatformIO's own source (PlatformBase.get_package_spec /
# configure_default_packages). Using it silently resolved back to the
# SHARED default package directory even with platform_packages correctly
# set, which is exactly the failure mode this whole isolation exists to
# prevent. Compute the private copy's path directly instead, derived from
# the shared default's own parent (the packages storage dir) — that lookup
# itself is reliable, only the package-NAME resolution isn't.
default_arduino_dir = Path(platform.get_package_dir("framework-arduinoespressif32"))
arduino_dir = _resolve_private_arduino_dir(default_arduino_dir)
if not arduino_dir.is_dir():
    raise RuntimeError(
        f"Private Arduino framework copy not found at {arduino_dir}. "
        "Create it (a full copy of the shared framework-arduinoespressif32 "
        "package, renamed to include the qrunlock-prov2 marker) before "
        "building esp32-c3-supermini-prov2."
    )
espidf_dir = Path(platform.get_package_dir("framework-espidf"))
arduino_variant = env.BoardConfig().get("build.mcu", "esp32c3")

_require_private_arduino_copy(arduino_dir)
_override_platform_package_dir(platform, arduino_dir)
# None of these are referenced anywhere in QRunlock's own src/ or main/
# (confirmed by grepping every #include across the whole tree and cross-
# checking against every library folder bundled in the Arduino package).
# QRunlock's real dependencies are HTTPClient, Preferences, Update,
# WebServer, WiFi, WiFiClientSecure (all kept), plus ESP-IDF's own native
# wifi_provisioning/protocomm components for prov2 specifically — not
# Arduino's WiFiProv wrapper or BLE library, which prov2 replaces. Excluding
# the rest avoids porting IDF-5.3.1 breakage in code that's never linked in.
for _unused_library in (
    "ArduinoOTA",
    "AsyncUDP",
    "BLE",
    "BluetoothSerial",
    "DNSServer",
    "EEPROM",
    "ESPmDNS",
    "Ethernet",
    "FFat",
    "HTTPUpdate",
    "HTTPUpdateServer",
    "I2S",
    "Insights",
    "LittleFS",
    "NetBIOS",
    "RainMaker",
    "SD",
    "SD_MMC",
    "SimpleBLE",
    "Ticker",
    "USB",
    "WiFiProv",
    "Wire",
):
    _exclude_unused_library(arduino_dir, _unused_library)
# Update/src/HttpsOTAUpdate.cpp is a separate, unused higher-level wrapper
# living inside the Update library folder QRunlock DOES need (Update.h's
# core flash-write API, via OtaService.cpp) — exclude only this one file,
# not the whole library. Doesn't compile under IDF 5.3.1 (esp_http_client_
# config_t/esp_https_ota_config_t type mismatch) and nothing calls it.
_exclude_unused_source_file(
    arduino_dir / "libraries" / "Update" / "src" / "HttpsOTAUpdate.cpp",
    "HttpsOTAUpdate is unused by QRunlock (OtaService.cpp uses Update.h "
    "directly) and does not compile under IDF 5.3.1.",
)

# Earlier bring-up attempts widened Arduino's include path to legacy SDK
# headers. That fixes one header but pollutes unrelated ESP-IDF components on
# ESP32-C3, so strip those injected lines back out and patch only the two
# legacy spiram includes that actually need redirection.
_replace_if_present(
    arduino_dir / "CMakeLists.txt",
    "  tools/sdk/${CONFIG_ARDUINO_VARIANT}/include/esp_hw_support/include/soc/esp32\n",
    "",
)
_replace_if_present(
    arduino_dir / "CMakeLists.txt",
    f"  tools/sdk/{arduino_variant}/include/esp_hw_support/include/soc/esp32\n",
    "",
)
_replace_if_present(
    arduino_dir / "CMakeLists.txt",
    "  tools/sdk/${CONFIG_ARDUINO_VARIANT}/include/esp_hw_support/include\n",
    "",
)
_ensure_spiram_include_dir(arduino_dir / "CMakeLists.txt")
# Non-fatal on purpose (unlike _require_private_arduino_copy's hard checks):
# the CMakeLists.txt "requires" line evolves as more components get added
# here over time, so a strict single before->after _replace_once would
# hard-fail every time an EARLIER patch in this same list already landed
# from a prior run. Cover every state seen so far; each is a no-op if its
# "before" text isn't present (already-updated or pristine-and-not-yet-
# reached, both fine).
_replace_if_present(
    arduino_dir / "CMakeLists.txt",
    "set(requires spi_flash mbedtls mdns esp_adc_cal wifi_provisioning nghttp wpa_supplicant)\n",
    "set(requires spi_flash mbedtls mdns esp_adc_cal driver esp_eth wifi_provisioning nghttp wpa_supplicant)\n",
)
_replace_if_present(
    arduino_dir / "CMakeLists.txt",
    "set(requires spi_flash mbedtls mdns esp_adc_cal driver wifi_provisioning nghttp wpa_supplicant)\n",
    "set(requires spi_flash mbedtls mdns esp_adc_cal driver esp_eth wifi_provisioning nghttp wpa_supplicant)\n",
)
_replace_once(
    arduino_dir / "cores" / "esp32" / "Arduino.h",
    "#include \"spiram.h\"\n",
    "#include \"esp32/spiram.h\"\n",
    "Arduino legacy spiram include rewrite",
)
_replace_once(
    arduino_dir / "cores" / "esp32" / "Arduino.h",
    "#include \"spiram.h\"\n",
    "#include \"esp32/spiram.h\"\n",
    "Arduino legacy spiram include",
)
_replace_once(
    arduino_dir / "cores" / "esp32" / "esp32-hal-psram.c",
    "#include \"spiram.h\"\n",
    "#include \"esp32/spiram.h\"\n",
    "Arduino PSRAM legacy spiram include rewrite",
)
_replace_once(
    arduino_dir / "cores" / "esp32" / "esp32-hal-psram.c",
    "#include \"spiram.h\"\n",
    "#include \"esp32/spiram.h\"\n",
    "Arduino PSRAM legacy spiram include",
)
_replace_if_present(
    arduino_dir
    / "tools"
    / "sdk"
    / arduino_variant
    / "include"
    / "esp_hw_support"
    / "include"
    / "soc"
    / "spinlock.h",
    "#include \"soc/cpu.h\"\n",
    "#include \"cpu.h\"\n",
)
_replace_if_present(
    arduino_dir
    / "tools"
    / "sdk"
    / arduino_variant
    / "include"
    / "esp_hw_support"
    / "include"
    / "soc"
    / "spinlock.h",
    "#include \"soc/compare_set.h\"\n",
    "#include \"compare_set.h\"\n",
)
_replace_if_present(
    arduino_dir
    / "tools"
    / "sdk"
    / arduino_variant
    / "include"
    / "esp_hw_support"
    / "include"
    / "soc"
    / "compare_set.h",
    "#include \"soc/cpu.h\"\n",
    "#include \"cpu.h\"\n",
)
_replace_if_present(
    arduino_dir
    / "tools"
    / "sdk"
    / arduino_variant
    / "include"
    / "esp_hw_support"
    / "include"
    / "soc"
    / "compare_set.h",
    "#include \"soc/soc_memory_types.h\"\n",
    "#include \"soc_memory_types.h\"\n",
)

_replace_once(
    arduino_dir / "libraries" / "WiFi" / "src" / "WiFiGeneric.h",
    "#include \"esp_event.h\"\n"
    "#include <functional>\n",
    "#include \"esp_event.h\"\n"
    "#include \"esp_netif_types.h\"\n"
    "#include \"esp_eth_driver.h\"\n"
    "#include <functional>\n",
    "Arduino WiFi IDF 5.3 type includes",
)

_replace_once(
    arduino_dir / "libraries" / "WiFi" / "src" / "WiFiClient.h",
    "class ESPLwIPClient : public Client\n"
    "{\n"
    "public:\n",
    "class ESPLwIPClient : public Client\n"
    "{\n"
    "public:\n"
    "        using Client::connect;\n",
    "Arduino WiFi Client overload visibility fix",
)

_replace_once(
    arduino_dir / "libraries" / "WiFiClientSecure" / "src" / "ssl_client.h",
    "#include \"mbedtls/net.h\"\n",
    "#include \"mbedtls/net_sockets.h\"\n",
    "Arduino WiFiClientSecure mbedtls net header fix",
)
_replace_once(
    arduino_dir / "cores" / "esp32" / "esp32-hal-cpu.c",
    "static xSemaphoreHandle apb_change_lock = NULL;\n",
    "static SemaphoreHandle_t apb_change_lock = NULL;\n",
    "Arduino CPU semaphore typedef fix",
)
_replace_once(
    arduino_dir / "cores" / "esp32" / "esp32-hal-adc.c",
    "static uint8_t __analogReturnedWidth = SOC_ADC_MAX_BITWIDTH; //12 for ESP32/ESP32C3; 13 for ESP32S2\n",
    "static uint8_t __analogReturnedWidth = SOC_ADC_RTC_MAX_BITWIDTH; //12 for ESP32/ESP32C3; 13 for ESP32S2\n",
    "Arduino ADC SoC bitwidth compatibility fix",
)
_replace_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c.c",
    "portTICK_RATE_MS",
    "portTICK_PERIOD_MS",
)
_replace_once(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c.c",
    "    // Freq limitation when using different clock sources\n"
    "    #define I2C_CLK_LIMIT_REF_TICK            (1 * 1000 * 1000 / 20)    /*!< Limited by REF_TICK, no more than REF_TICK/20*/\n"
    "    #define I2C_CLK_LIMIT_APB                 (80 * 1000 * 1000 / 20)   /*!< Limited by APB, no more than APB/20*/\n"
    "    #define I2C_CLK_LIMIT_RTC                 (20 * 1000 * 1000 / 20)   /*!< Limited by RTC, no more than RTC/20*/\n"
    "    #define I2C_CLK_LIMIT_XTAL                (40 * 1000 * 1000 / 20)   /*!< Limited by RTC, no more than XTAL/20*/\n"
    "\n"
    "    typedef struct {\n"
    "        uint8_t character;          /*!< I2C source clock characteristic */\n"
    "        uint32_t clk_freq;          /*!< I2C source clock frequency */\n"
    "    } i2c_clk_alloc_t;\n"
    "\n"
    "    // i2c clock characteristic, The order is the same as i2c_sclk_t.\n"
    "    static i2c_clk_alloc_t i2c_clk_alloc[I2C_SCLK_MAX] = {\n"
    "        {0, 0},\n"
    "    #if SOC_I2C_SUPPORT_APB\n"
    "        {0, I2C_CLK_LIMIT_APB},                                                                /*!< I2C APB clock characteristic*/\n"
    "    #endif\n"
    "    #if SOC_I2C_SUPPORT_XTAL\n"
    "        {0, I2C_CLK_LIMIT_XTAL},                                                               /*!< I2C XTAL characteristic*/\n"
    "    #endif\n"
    "    #if SOC_I2C_SUPPORT_RTC\n"
    "        {I2C_SCLK_SRC_FLAG_LIGHT_SLEEP | I2C_SCLK_SRC_FLAG_AWARE_DFS, I2C_CLK_LIMIT_RTC},      /*!< I2C 20M RTC characteristic*/\n"
    "    #endif\n"
    "    #if SOC_I2C_SUPPORT_REF_TICK\n"
    "        {I2C_SCLK_SRC_FLAG_AWARE_DFS, I2C_CLK_LIMIT_REF_TICK},                                 /*!< I2C REF_TICK characteristic*/\n"
    "    #endif\n"
    "    };\n"
    "\n"
    "    i2c_sclk_t src_clk = I2C_SCLK_DEFAULT;\n"
    "    ret = ESP_OK;\n"
    "    for (i2c_sclk_t clk = I2C_SCLK_DEFAULT + 1; clk < I2C_SCLK_MAX; clk++) {\n"
    "#if CONFIG_IDF_TARGET_ESP32S3\n"
    "        if (clk == I2C_SCLK_RTC) { // RTC clock for s3 is unaccessable now.\n"
    "            continue;\n"
    "        }\n"
    "#endif\n"
    "        if (frequency <= i2c_clk_alloc[clk].clk_freq) {\n"
    "            src_clk = clk;\n"
    "            break;\n"
    "        }\n"
    "    }\n"
    "    if(src_clk == I2C_SCLK_MAX){\n"
    "        log_e(\"clock source could not be selected\");\n"
    "        ret = ESP_FAIL;\n"
    "    } else {\n"
    "        i2c_hal_context_t hal;\n"
    "        hal.dev = I2C_LL_GET_HW(i2c_num);\n"
    "        i2c_hal_set_bus_timing(&(hal), frequency, src_clk);\n"
    "        bus[i2c_num].frequency = frequency;\n"
    "        //Clock Stretching Timeout: 20b:esp32, 5b:esp32-c3, 24b:esp32-s2\n"
    "        i2c_set_timeout((i2c_port_t)i2c_num, I2C_LL_MAX_TIMEOUT);\n"
    "    }\n",
    "    i2c_clock_source_t src_clk;\n"
    "    uint32_t src_clk_hz;\n"
    "\n"
    "#if SOC_I2C_SUPPORT_APB\n"
    "    src_clk = SOC_MOD_CLK_APB;\n"
    "    src_clk_hz = APB_CLK_FREQ;\n"
    "#elif SOC_I2C_SUPPORT_XTAL\n"
    "    src_clk = I2C_CLK_SRC_XTAL;\n"
    "    src_clk_hz = XTAL_CLK_FREQ;\n"
    "#elif SOC_I2C_SUPPORT_RTC\n"
    "    src_clk = I2C_CLK_SRC_RC_FAST;\n"
    "    src_clk_hz = SOC_CLK_RC_FAST_FREQ_APPROX;\n"
    "#else\n"
    "#error \"Unsupported I2C source clock configuration for Arduino IDF 5.3 compatibility patch\"\n"
    "#endif\n"
    "\n"
    "    i2c_hal_clk_config_t clk_cal;\n"
    "    i2c_dev_t *dev = I2C_LL_GET_HW(i2c_num);\n"
    "\n"
    "    ret = ESP_OK;\n"
    "    i2c_ll_set_source_clk(dev, src_clk);\n"
    "    i2c_ll_master_cal_bus_clk(src_clk_hz, frequency, &clk_cal);\n"
    "    i2c_ll_master_set_bus_timing(dev, &clk_cal);\n"
    "    bus[i2c_num].frequency = frequency;\n"
    "    //Clock Stretching Timeout: 20b:esp32, 5b:esp32-c3, 24b:esp32-s2\n"
    "    i2c_set_timeout((i2c_port_t)i2c_num, I2C_LL_MAX_TIMEOUT);\n",
    "Arduino I2C master clock-source compatibility fix",
)
_replace_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c-slave.c",
    "xQueueHandle",
    "QueueHandle_t",
)
_replace_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c-slave.c",
    "xSemaphoreHandle",
    "SemaphoreHandle_t",
)
_replace_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c-slave.c",
    "portTICK_RATE_MS",
    "portTICK_PERIOD_MS",
)
_replace_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c-slave.c",
    "i2c_ll_set_fifo_mode(i2c->dev, true);",
    "i2c_ll_slave_set_fifo_mode(i2c->dev, true);",
)
_replace_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c-slave.c",
    "i2c_ll_clr_intsts_mask",
    "i2c_ll_clear_intr_mask",
)
_replace_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c-slave.c",
    "i2c_clk_cal_t",
    "i2c_hal_clk_config_t",
)
_replace_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c-slave.c",
    "i2c_ll_cal_bus_clk",
    "i2c_ll_master_cal_bus_clk",
)
_replace_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c-slave.c",
    "i2c_ll_set_bus_timing",
    "i2c_ll_master_set_bus_timing",
)
_replace_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c-slave.c",
    "i2c_ll_set_filter",
    "i2c_ll_master_set_filter",
)
_replace_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c-slave.c",
    "I2C_SCLK_APB",
    "SOC_MOD_CLK_APB",
)
_replace_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c-slave.c",
    "I2C_SCLK_XTAL",
    "SOC_MOD_CLK_XTAL",
)
_replace_regex_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c-slave.c",
    r"(?:qrunlock_)+i2c_ll_get_txfifo_len\(i2c->dev\)",
    "qrunlock_i2c_ll_get_txfifo_len(i2c->dev)",
)
_replace_regex_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c-slave.c",
    r"(?<!qrunlock_)i2c_ll_get_txfifo_len\(i2c->dev\)",
    "qrunlock_i2c_ll_get_txfifo_len(i2c->dev)",
)
_replace_regex_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c-slave.c",
    r"(?:qrunlock_)+i2c_ll_get_rxfifo_cnt\(i2c->dev\)",
    "qrunlock_i2c_ll_get_rxfifo_cnt(i2c->dev)",
)
_replace_regex_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c-slave.c",
    r"(?<!qrunlock_)i2c_ll_get_rxfifo_cnt\(i2c->dev\)",
    "qrunlock_i2c_ll_get_rxfifo_cnt(i2c->dev)",
)
_replace_regex_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c-slave.c",
    r"(?:qrunlock_)+i2c_ll_get_intr_mask\(i2c->dev\)",
    "qrunlock_i2c_ll_get_intr_mask(i2c->dev)",
)
_replace_regex_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c-slave.c",
    r"(?<!qrunlock_)i2c_ll_get_intr_mask\(i2c->dev\)",
    "qrunlock_i2c_ll_get_intr_mask(i2c->dev)",
)
_replace_once(
    arduino_dir / "cores" / "esp32" / "esp32-hal-ledc.c",
    "#define LEDC_MAX_BIT_WIDTH      SOC_LEDC_TIMER_BIT_WIDE_NUM\n",
    "#define LEDC_MAX_BIT_WIDTH      SOC_LEDC_TIMER_BIT_WIDTH\n",
    "Arduino LEDC SoC bit width macro compatibility fix",
)
_replace_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-sigmadelta.c",
    "SOC_SIGMADELTA_CHANNEL_NUM",
    "SIGMADELTA_CHANNEL_MAX",
)
_replace_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-spi.c",
    "xSemaphoreHandle",
    "SemaphoreHandle_t",
)
_replace_once(
    arduino_dir / "cores" / "esp32" / "esp32-hal-uart.c",
    "#if CONFIG_IDF_TARGET_ESP32 || CONFIG_IDF_TARGET_ESP32S2\n"
    "    uart_ll_set_baudrate(UART_LL_GET_HW(uart->num), _get_effective_baudrate(baud_rate));\n"
    "#else\n"
    "    uart_ll_set_baudrate(UART_LL_GET_HW(uart->num), baud_rate);\n"
    "#endif\n",
    "#if CONFIG_IDF_TARGET_ESP32 || CONFIG_IDF_TARGET_ESP32S2\n"
    "    uart_ll_set_baudrate(UART_LL_GET_HW(uart->num), _get_effective_baudrate(baud_rate));\n"
    "#else\n"
    "    uart_ll_set_baudrate(UART_LL_GET_HW(uart->num), baud_rate, XTAL_CLK_FREQ);\n"
    "#endif\n",
    "Arduino UART baud-rate setter compatibility fix",
)
_replace_once(
    arduino_dir / "cores" / "esp32" / "esp32-hal-uart.c",
    "    uint32_t baud_rate = uart_ll_get_baudrate(UART_LL_GET_HW(uart->num));\n",
    "    uint32_t baud_rate = uart_ll_get_baudrate(UART_LL_GET_HW(uart->num), XTAL_CLK_FREQ);\n",
    "Arduino UART baud-rate getter compatibility fix",
)
_replace_if_present(
    arduino_dir / "cores" / "esp32" / "esp32-hal-rmt.c",
    "xSemaphoreHandle",
    "SemaphoreHandle_t",
)
_replace_once(
    arduino_dir / "cores" / "esp32" / "Esp.cpp",
    "#include \"esp_spi_flash.h\"\n",
    "#include \"esp_spi_flash.h\"\n"
    "#include \"esp_chip_info.h\"\n"
    "#include \"esp_flash.h\"\n"
    "#include \"esp_mac.h\"\n",
    "Arduino Esp.cpp IDF 5.3 header compatibility fix",
)
_replace_once(
    arduino_dir / "cores" / "esp32" / "Esp.cpp",
    "bool EspClass::flashEraseSector(uint32_t sector)\n"
    "{\n"
    "    return spi_flash_erase_sector(sector) == ESP_OK;\n"
    "}\n"
    "\n"
    "// Warning: These functions do not work with encrypted flash\n"
    "bool EspClass::flashWrite(uint32_t offset, uint32_t *data, size_t size)\n"
    "{\n"
    "    return spi_flash_write(offset, (uint32_t*) data, size) == ESP_OK;\n"
    "}\n"
    "\n"
    "bool EspClass::flashRead(uint32_t offset, uint32_t *data, size_t size)\n"
    "{\n"
    "    return spi_flash_read(offset, (uint32_t*) data, size) == ESP_OK;\n"
    "}\n",
    "bool EspClass::flashEraseSector(uint32_t sector)\n"
    "{\n"
    "    return esp_flash_erase_region(NULL, sector * SPI_FLASH_SEC_SIZE, SPI_FLASH_SEC_SIZE) == ESP_OK;\n"
    "}\n"
    "\n"
    "// Warning: These functions do not work with encrypted flash\n"
    "bool EspClass::flashWrite(uint32_t offset, uint32_t *data, size_t size)\n"
    "{\n"
    "    return esp_flash_write(NULL, (const void*)data, offset, size) == ESP_OK;\n"
    "}\n"
    "\n"
    "bool EspClass::flashRead(uint32_t offset, uint32_t *data, size_t size)\n"
    "{\n"
    "    return esp_flash_read(NULL, (void*)data, offset, size) == ESP_OK;\n"
    "}\n",
    "Arduino Esp.cpp flash API compatibility fix",
)
_replace_once(
    arduino_dir / "cores" / "esp32" / "HardwareSerial.cpp",
    "#include <inttypes.h>\n",
    "#include <inttypes.h>\n"
    "#include <ctime>\n",
    "Arduino HardwareSerial time_t include compatibility fix",
)
_replace_once(
    arduino_dir / "cores" / "esp32" / "HWCDC.cpp",
    "#include \"esp_private/startup_internal.h\"\n"
    "#include \"esp_freertos_hooks.h\"\n",
    "#include \"esp_private/startup_internal.h\"\n"
    "#include \"esp_freertos_hooks.h\"\n"
    "#if CONFIG_IDF_TARGET_ESP32C3\n"
    "#include \"esp32c3/rom/ets_sys.h\"\n"
    "#ifndef USB_DM_GPIO_NUM\n"
    "#define USB_DM_GPIO_NUM GPIO_NUM_18\n"
    "#endif\n"
    "#ifndef USB_DP_GPIO_NUM\n"
    "#define USB_DP_GPIO_NUM GPIO_NUM_19\n"
    "#endif\n"
    "#else\n"
    "#include \"esp32s3/rom/ets_sys.h\"\n"
    "#ifndef USB_DM_GPIO_NUM\n"
    "#define USB_DM_GPIO_NUM GPIO_NUM_19\n"
    "#endif\n"
    "#ifndef USB_DP_GPIO_NUM\n"
    "#define USB_DP_GPIO_NUM GPIO_NUM_20\n"
    "#endif\n"
    "#endif\n",
    "Arduino HWCDC ROM and USB pin compatibility fix",
)
_replace_if_present(
    arduino_dir / "cores" / "esp32" / "HWCDC.cpp",
    "xQueueHandle",
    "QueueHandle_t",
)
_replace_if_present(
    arduino_dir / "cores" / "esp32" / "HWCDC.cpp",
    "xSemaphoreHandle",
    "SemaphoreHandle_t",
)
_replace_once(
    arduino_dir / "cores" / "esp32" / "HWCDC.cpp",
    "ESP_SYSTEM_INIT_FN(usb_serial_jtag_conn_status_init, BIT(0))\n"
    "{\n"
    "  s_usb_serial_jtag_conn_status = true;\n"
    "  remaining_allowed_no_sof_ticks = ALLOWED_NO_SOF_TICKS;\n"
    "  esp_register_freertos_tick_hook(usb_serial_jtag_sof_tick_hook);\n"
    "}\n",
    "ESP_SYSTEM_INIT_FN(usb_serial_jtag_conn_status_init, SECONDARY, BIT(0), 230)\n"
    "{\n"
    "  s_usb_serial_jtag_conn_status = true;\n"
    "  remaining_allowed_no_sof_ticks = ALLOWED_NO_SOF_TICKS;\n"
    "  return esp_register_freertos_tick_hook(usb_serial_jtag_sof_tick_hook);\n"
    "}\n",
    "Arduino HWCDC startup hook compatibility fix",
)
_replace_once(
    arduino_dir / "cores" / "esp32" / "WMath.cpp",
    "#include \"esp_system.h\"\n",
    "#include \"esp_system.h\"\n"
    "#include \"esp_random.h\"\n",
    "Arduino WMath esp_random declaration compatibility fix",
)
_replace_once(
    arduino_dir / "cores" / "esp32" / "esp32-hal-i2c-slave.c",
    "static inline bool i2c_ll_slave_rw(i2c_dev_t *hw)//not exposed by hal_ll\n"
    "{\n"
    "#if CONFIG_IDF_TARGET_ESP32C3 || CONFIG_IDF_TARGET_ESP32S3\n"
    "    return hw->sr.slave_rw;\n"
    "#else\n"
    "    return hw->status_reg.slave_rw;\n"
    "#endif\n"
    "}\n",
    "static inline bool i2c_ll_slave_rw(i2c_dev_t *hw)//not exposed by hal_ll\n"
    "{\n"
    "#if CONFIG_IDF_TARGET_ESP32C3 || CONFIG_IDF_TARGET_ESP32S3\n"
    "    return hw->sr.slave_rw;\n"
    "#else\n"
    "    return hw->status_reg.slave_rw;\n"
    "#endif\n"
    "}\n"
    "\n"
    "static inline uint32_t qrunlock_i2c_ll_get_intr_mask(i2c_dev_t *hw)\n"
    "{\n"
    "    uint32_t intr_status = 0;\n"
    "    i2c_ll_get_intr_mask(hw, &intr_status);\n"
    "    return intr_status;\n"
    "}\n"
    "\n"
    "static inline uint32_t qrunlock_i2c_ll_get_rxfifo_cnt(i2c_dev_t *hw)\n"
    "{\n"
    "    uint32_t length = 0;\n"
    "    i2c_ll_get_rxfifo_cnt(hw, &length);\n"
    "    return length;\n"
    "}\n"
    "\n"
    "static inline uint32_t qrunlock_i2c_ll_get_txfifo_len(i2c_dev_t *hw)\n"
    "{\n"
    "    uint32_t length = 0;\n"
    "    i2c_ll_get_txfifo_len(hw, &length);\n"
    "    return length;\n"
    "}\n",
    "Arduino I2C slave LL compatibility helpers",
)

# ESP-IDF 5.3.1's bundled mbedtls CMake has a typo that prevents the generated
# x509_crt_bundle artifact from being built before it is embedded.
_replace_once(
    espidf_dir / "components" / "mbedtls" / "CMakeLists.txt",
    "    add_custom_target(custom_bundle DEPENDS ${cert_bundle})\n",
    "    add_custom_target(custom_bundle DEPENDS ${crt_bundle})\n",
    "ESP-IDF crt bundle dependency fix",
)

# QRunlock's prov2 pilot doesn't use managed ESP-IDF components. Disabling the
# component manager avoids a PlatformIO-packaged IDF 5.3.1 mismatch where
# project.cmake still asks for interface version 2 while the installed Python
# package only accepts newer interface versions.
os.environ["IDF_COMPONENT_MANAGER"] = "0"
env["ENV"]["IDF_COMPONENT_MANAGER"] = "0"

# PlatformIO's bundled Arduino-as-component package for this project still
# hard-gates ESP-IDF to 4.4.x in CMake, even though the prov2 pilot is pinned
# to IDF 5.3.1 specifically for Security 2 support. Espressif's own
# arduino-esp32 CMakeLists documents this escape hatch for advanced
# Arduino-as-component builds.
os.environ["ARDUINO_SKIP_IDF_VERSION_CHECK"] = "1"
env["ENV"]["ARDUINO_SKIP_IDF_VERSION_CHECK"] = "1"

# The mixed Arduino+ESP-IDF build intermittently archives framework libraries
# before all object files land when parallelized on this Windows setup.
env.SetOption("num_jobs", 1)
