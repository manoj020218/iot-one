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


platform = env.PioPlatform()
arduino_dir = Path(platform.get_package_dir("framework-arduinoespressif32"))
espidf_dir = Path(platform.get_package_dir("framework-espidf"))
arduino_variant = env.BoardConfig().get("build.mcu", "esp32c3")
arduino_soc_compat_dir = (
    arduino_dir
    / "tools"
    / "sdk"
    / arduino_variant
    / "include"
    / "esp_hw_support"
    / "include"
    / "soc"
)

# Arduino-as-component on IDF 5.3 still expects the legacy spiram header layout
# that exists only inside the Arduino package's bundled SDK tree.
_replace_once(
    arduino_dir / "CMakeLists.txt",
    "set(includedirs\n"
    "  variants/${CONFIG_ARDUINO_VARIANT}/\n"
    "  cores/esp32/\n",
    "set(includedirs\n"
    "  variants/${CONFIG_ARDUINO_VARIANT}/\n"
    "  cores/esp32/\n"
    "  tools/sdk/${CONFIG_ARDUINO_VARIANT}/include/esp_hw_support/include/soc\n",
    "Arduino SDK compat include path",
)

# ESP-IDF 5.3.1's bundled mbedtls CMake has a typo that prevents the generated
# x509_crt_bundle artifact from being built before it is embedded.
_replace_once(
    espidf_dir / "components" / "mbedtls" / "CMakeLists.txt",
    "    add_custom_target(custom_bundle DEPENDS ${cert_bundle})\n",
    "    add_custom_target(custom_bundle DEPENDS ${crt_bundle})\n",
    "ESP-IDF crt bundle dependency fix",
)

env.Append(CPPPATH=[str(arduino_soc_compat_dir)])


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
