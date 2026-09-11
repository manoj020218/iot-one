file(GLOB_RECURSE app_sources "${CMAKE_CURRENT_LIST_DIR}/*.cpp")

set(app_requires
  driver
  esp_adc
  esp_audio_codec
  esp_event
  esp_http_client
  app_update
  mbedtls
  mqtt
  esp_netif
  esp_wifi
  fatfs
  json
  littlefs
  mdns
  nvs_flash
)

# Only the esp32-s3-schoolbell-prov env sets this (platformio.ini's
# board_build.cmake_extra_args) -- the default esp32-s3-schoolbell env never
# pulls jenix_provisioning into its build.
if(JENIX_PROV_STANDARD)
  list(APPEND app_requires jenix_provisioning)
endif()

idf_component_register(
  SRCS ${app_sources}
  INCLUDE_DIRS "../include"
  REQUIRES ${app_requires}
)
