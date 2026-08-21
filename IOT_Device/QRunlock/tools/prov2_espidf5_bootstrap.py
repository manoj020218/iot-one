Import("env")

import os
from pathlib import Path


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


platform = env.PioPlatform()
arduino_dir = Path(platform.get_package_dir("framework-arduinoespressif32"))
espidf_dir = Path(platform.get_package_dir("framework-espidf"))
arduino_variant = env.BoardConfig().get("build.mcu", "esp32c3")

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
