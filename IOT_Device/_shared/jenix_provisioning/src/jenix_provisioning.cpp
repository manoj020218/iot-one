#include "jenix_provisioning.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

#include "esp_event.h"
#include "esp_log.h"
#include "esp_mac.h"
#include "esp_netif.h"
#include "esp_netif_ip_addr.h"
#include "esp_random.h"
#include "esp_srp.h"
#include "esp_wifi.h"
#include "nvs.h"
#include "protocomm_security.h"
#include "wifi_provisioning/manager.h"
#include "wifi_provisioning/scheme_ble.h"
#include "wifi_provisioning/scheme_softap.h"

namespace {

constexpr char kTag[] = "JenixProvisioning";
constexpr char kNvsNamespace[] = "jnx_prov";
constexpr char kNvsPopKey[] = "pop";
constexpr char kSec2Username[] = "jenix";
constexpr int kSec2SaltBytes = 16;
constexpr int kGeneratedPopChars = 12;

bool g_mgr_initialized = false;
bool g_active = false;
jenix_provisioning_scheme_t g_active_scheme = JENIX_PROV_SCHEME_BLE;
char g_service_name[32] = {};
char g_device_id[32] = {};
char g_generated_pop[kGeneratedPopChars + 1] = {};
std::vector<char>* g_sec2_salt = nullptr;
std::vector<char>* g_sec2_verifier = nullptr;
jenix_provisioning_callbacks_t g_callbacks = {};
void* g_callback_ctx = nullptr;

void ReadStationMac(uint8_t out_mac[6]) { esp_read_mac(out_mac, ESP_MAC_WIFI_STA); }

// Loads a manufacturing-burned PoP from NVS if one was ever written there by
// a previous first-boot generation, else generates a fresh one, persists it,
// and prints it to stdout for bench use (PROVISIONING.md Section 7's
// pilot-interim pattern -- a real manufacturing-time burn step still needs
// to replace this before field shipment).
const char* GenerateOrLoadPop() {
  nvs_handle_t handle = 0;
  if (nvs_open(kNvsNamespace, NVS_READWRITE, &handle) != ESP_OK) {
    ESP_LOGE(kTag, "Could not open NVS namespace for Proof-of-Possession");
    return nullptr;
  }

  size_t size = sizeof(g_generated_pop);
  if (nvs_get_str(handle, kNvsPopKey, g_generated_pop, &size) == ESP_OK &&
      g_generated_pop[0] != '\0') {
    nvs_close(handle);
    ESP_LOGI(kTag, "Using persisted first-boot Proof-of-Possession");
    return g_generated_pop;
  }

  static const char kAlphabet[] = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (int i = 0; i < kGeneratedPopChars; ++i) {
    g_generated_pop[i] = kAlphabet[esp_random() % (sizeof(kAlphabet) - 1)];
  }
  g_generated_pop[kGeneratedPopChars] = '\0';

  const esp_err_t save_result = nvs_set_str(handle, kNvsPopKey, g_generated_pop);
  if (save_result == ESP_OK) nvs_commit(handle);
  nvs_close(handle);

  if (save_result != ESP_OK) {
    ESP_LOGE(kTag, "Failed to persist generated Proof-of-Possession: %s",
              esp_err_to_name(save_result));
  }

  // Bench-only visibility -- this is the pilot's only way to hand the PoP to
  // a phone until a manufacturing-time burn/print step exists.
  printf("[JENIX-PROVISIONING] first-boot Proof-of-Possession = %s\n", g_generated_pop);
  ESP_LOGW(kTag, "Generated first-boot Proof-of-Possession (bench-only, see Serial output)");
  return g_generated_pop;
}

bool BuildSec2Material(const char* pop) {
  if (pop == nullptr || pop[0] == '\0') return false;

  char* salt = nullptr;
  char* verifier = nullptr;
  int verifier_len = 0;
  const esp_err_t result = esp_srp_gen_salt_verifier(
      kSec2Username, static_cast<int>(std::strlen(kSec2Username)), pop,
      static_cast<int>(std::strlen(pop)), &salt, kSec2SaltBytes, &verifier, &verifier_len);
  if (result != ESP_OK || salt == nullptr || verifier == nullptr || verifier_len <= 0) {
    if (salt != nullptr) std::free(salt);
    if (verifier != nullptr) std::free(verifier);
    ESP_LOGE(kTag, "Security2 SRP material generation failed err=%s", esp_err_to_name(result));
    return false;
  }

  delete g_sec2_salt;
  delete g_sec2_verifier;
  g_sec2_salt = new std::vector<char>(salt, salt + kSec2SaltBytes);
  g_sec2_verifier = new std::vector<char>(verifier, verifier + verifier_len);
  std::free(salt);
  std::free(verifier);
  return true;
}

void HandleProvEvent(int32_t event_id, void* event_data) {
  switch (event_id) {
    case WIFI_PROV_START:
      ESP_LOGI(kTag, "Provisioning started, service name=%s", g_service_name);
      break;
    case WIFI_PROV_CRED_RECV: {
      const auto* wifi_sta_config = static_cast<wifi_sta_config_t*>(event_data);
      if (wifi_sta_config != nullptr) {
        ESP_LOGI(kTag, "Received Wi-Fi credentials for SSID %s",
                  reinterpret_cast<const char*>(wifi_sta_config->ssid));
      }
      break;
    }
    case WIFI_PROV_CRED_FAIL:
      ESP_LOGW(kTag, "Provisioning Wi-Fi connect failed");
      wifi_prov_mgr_reset_sm_state_on_failure();
      break;
    case WIFI_PROV_CRED_SUCCESS:
      ESP_LOGI(kTag, "Provisioning Wi-Fi connect succeeded");
      break;
    case WIFI_PROV_END:
      g_active = false;
      wifi_prov_mgr_deinit();
      g_mgr_initialized = false;
      ESP_LOGI(kTag, "Provisioning stopped");
      break;
    default:
      break;
  }
}

void HandleIpEvent(int32_t event_id, void* event_data) {
  if (event_id != IP_EVENT_STA_GOT_IP || event_data == nullptr) return;

  const auto* got_ip = static_cast<ip_event_got_ip_t*>(event_data);
  char ip[16] = {};
  esp_ip4addr_ntoa(&got_ip->ip_info.ip, ip, sizeof(ip));
  ESP_LOGI(kTag, "Wi-Fi connected, device_id=%s ip=%s", g_device_id, ip);
  if (g_callbacks.on_wifi_connected != nullptr) {
    g_callbacks.on_wifi_connected(g_device_id, ip, g_callback_ctx);
  }
}

void EventHandler(void* arg, esp_event_base_t event_base, int32_t event_id, void* event_data) {
  (void)arg;
  if (event_base == WIFI_PROV_EVENT) {
    HandleProvEvent(event_id, event_data);
  } else if (event_base == IP_EVENT) {
    HandleIpEvent(event_id, event_data);
  }
}

}  // namespace

esp_err_t jenix_provisioning_build_name(const char* product_code, char* out, size_t out_len) {
  if (product_code == nullptr || out == nullptr) return ESP_ERR_INVALID_ARG;

  uint8_t mac[6] = {};
  ReadStationMac(mac);
  const int written = std::snprintf(out, out_len, "JNX%s%02X%02X%02X", product_code, mac[3],
                                     mac[4], mac[5]);
  if (written < 0 || static_cast<size_t>(written) >= out_len) return ESP_ERR_INVALID_SIZE;
  return ESP_OK;
}

esp_err_t jenix_provisioning_start(jenix_provisioning_scheme_t scheme,
                                    const jenix_provisioning_config_t* config,
                                    const jenix_provisioning_callbacks_t* callbacks,
                                    void* callback_ctx) {
  if (config == nullptr || config->product_code == nullptr) return ESP_ERR_INVALID_ARG;
  if (g_active && g_active_scheme == scheme) return ESP_OK;
  if (g_active && g_active_scheme != scheme) {
    // wifi_prov_mgr is a singleton (one static context, one scheme) -- switch
    // by tearing the old scheme down first. wifi_prov_mgr_deinit() stops
    // provisioning first if it's running, so this is safe to call directly.
    ESP_LOGI(kTag, "Switching provisioning scheme, deinitializing current one first");
    wifi_prov_mgr_deinit();
    g_mgr_initialized = false;
    g_active = false;
  }

  const esp_err_t name_result =
      jenix_provisioning_build_name(config->product_code, g_service_name, sizeof(g_service_name));
  if (name_result != ESP_OK) return name_result;
  std::strncpy(g_device_id, g_service_name, sizeof(g_device_id) - 1);

  const char* pop = (config->proof_of_possession != nullptr && config->proof_of_possession[0] != '\0')
                         ? config->proof_of_possession
                         : GenerateOrLoadPop();
  if (!BuildSec2Material(pop)) return ESP_FAIL;

  // Standardized, always-printed (not just on first-ever generation) factory
  // capture line -- a bench/factory tool greps this once per boot instead of
  // relying on the PoP only being visible the one time it was first
  // generated. One shared format for every jenix_provisioning consumer.
  printf("[FACTORY] pid=%s ble_name=%s pop_username=%s pop=%s\n",
         config->pid != nullptr ? config->pid : "", g_service_name, kSec2Username, pop);

  if (callbacks != nullptr) {
    g_callbacks = *callbacks;
  } else {
    g_callbacks = {};
  }
  g_callback_ctx = callback_ctx;

  static bool handlers_registered = false;
  if (!handlers_registered) {
    esp_event_handler_register(WIFI_PROV_EVENT, ESP_EVENT_ANY_ID, &EventHandler, nullptr);
    esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &EventHandler, nullptr);
    handlers_registered = true;
  }

  if (!g_mgr_initialized) {
    wifi_prov_mgr_config_t manager_config = {};
    manager_config.scheme =
        (scheme == JENIX_PROV_SCHEME_SOFTAP) ? wifi_prov_scheme_softap : wifi_prov_scheme_ble;
    manager_config.scheme_event_handler.event_cb = nullptr;
    manager_config.scheme_event_handler.user_data = nullptr;
    manager_config.app_event_handler.event_cb = nullptr;
    manager_config.app_event_handler.user_data = nullptr;

    const esp_err_t init_result = wifi_prov_mgr_init(manager_config);
    if (init_result != ESP_OK) {
      ESP_LOGE(kTag, "wifi_prov_mgr_init failed: %s", esp_err_to_name(init_result));
      return init_result;
    }
    g_mgr_initialized = true;
  }

  if (scheme == JENIX_PROV_SCHEME_SOFTAP && config->softap_httpd_handle != nullptr) {
    // Reuse the caller's existing httpd server instead of starting a second
    // one -- lets a device's own diagnostic HTTP routes keep working on the
    // same AP+server the provisioning endpoints get registered onto.
    wifi_prov_scheme_softap_set_httpd_handle(config->softap_httpd_handle);
  }

  wifi_prov_security2_params_t sec2_params = {};
  sec2_params.salt = g_sec2_salt->data();
  sec2_params.salt_len = static_cast<uint16_t>(g_sec2_salt->size());
  sec2_params.verifier = g_sec2_verifier->data();
  sec2_params.verifier_len = static_cast<uint16_t>(g_sec2_verifier->size());

  const esp_err_t start_result = wifi_prov_mgr_start_provisioning(
      WIFI_PROV_SECURITY_2, &sec2_params, g_service_name, nullptr);
  if (start_result != ESP_OK) {
    ESP_LOGE(kTag, "wifi_prov_mgr_start_provisioning failed: %s", esp_err_to_name(start_result));
    return start_result;
  }

  g_active = true;
  g_active_scheme = scheme;
  return ESP_OK;
}

void jenix_provisioning_stop() {
  if (g_active) {
    wifi_prov_mgr_stop_provisioning();
    return;
  }
  if (g_mgr_initialized) {
    wifi_prov_mgr_deinit();
    g_mgr_initialized = false;
  }
}

bool jenix_provisioning_is_active() { return g_active; }
