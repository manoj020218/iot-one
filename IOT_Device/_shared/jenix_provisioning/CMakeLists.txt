# Reference component registration -- for a project whose own path has no
# spaces, point EXTRA_COMPONENT_DIRS straight at this directory and this
# file is what gets used directly. In *this* repo, every consumer's actual
# path does contain spaces (e.g. "Smart School Bell"), which breaks ESP-IDF's
# EXTRA_COMPONENT_DIRS space-disambiguation heuristic once more than one
# space-containing entry is involved (confirmed 2026-09-11) -- so real
# consumers here use a thin forwarding-stub CMakeLists.txt under their own
# project's components/<name>/ instead (see e.g. School Bell's
# firmware/components/jenix_provisioning/CMakeLists.txt), which ESP-IDF
# auto-discovers with no extra config. Keep both in sync if you touch the
# REQUIRES list.
idf_component_register(
  SRCS "src/jenix_provisioning.cpp"
  INCLUDE_DIRS "include"
  REQUIRES
    wifi_provisioning
    protocomm
    esp_wifi
    esp_event
    esp_netif
    esp_http_server
    nvs_flash
    mbedtls
)
