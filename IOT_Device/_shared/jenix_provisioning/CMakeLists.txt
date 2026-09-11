idf_component_register(
  SRCS "src/jenix_provisioning.cpp"
  INCLUDE_DIRS "include"
  REQUIRES
    wifi_provisioning
    protocomm
    esp_wifi
    esp_event
    esp_netif
    nvs_flash
    mbedtls
)
