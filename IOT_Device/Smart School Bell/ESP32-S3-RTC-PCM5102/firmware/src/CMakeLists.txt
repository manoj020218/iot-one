file(GLOB_RECURSE app_sources "${CMAKE_CURRENT_LIST_DIR}/*.cpp")

idf_component_register(
  SRCS ${app_sources}
  INCLUDE_DIRS "../include"
  REQUIRES
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
