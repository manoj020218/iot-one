Import("env")

import os
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
_replace_once(
    arduino_dir / "CMakeLists.txt",
    "set(requires spi_flash mbedtls mdns esp_adc_cal wifi_provisioning nghttp wpa_supplicant)\n",
    "set(requires spi_flash mbedtls mdns esp_adc_cal driver wifi_provisioning nghttp wpa_supplicant)\n",
    "Arduino component driver dependency for legacy ADC/I2C headers",
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
