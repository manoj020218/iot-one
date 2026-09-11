# Thin forwarding stub, no duplicated source -- the real component lives at
# IOT_Device/_shared/jenix_provisioning/ (PROVISIONING.md Section 8a: one
# shared implementation, not a per-device copy). This stub exists only
# because ESP-IDF auto-discovers a project's own "components/" directory
# with zero extra config, whereas pointing EXTRA_COMPONENT_DIRS directly at
# ../../_shared hits a real ESP-IDF limitation in this repo's path (see
# ../../CMakeLists.txt's comment) -- confirmed broken 2026-09-11.
#
# Only pulled into the build when src/CMakeLists.txt's REQUIRES lists
# "jenix_provisioning" (JENIX_PROV_STANDARD env only); mere discovery here
# does not affect the default esp32-s3-schoolbell env.

set(jenix_provisioning_shared_dir "${CMAKE_CURRENT_LIST_DIR}/../../../../../_shared/jenix_provisioning")

idf_component_register(
  SRCS "${jenix_provisioning_shared_dir}/src/jenix_provisioning.cpp"
  INCLUDE_DIRS "${jenix_provisioning_shared_dir}/include"
  REQUIRES
    wifi_provisioning
    protocomm
    esp_wifi
    esp_event
    esp_netif
    nvs_flash
    mbedtls
)
