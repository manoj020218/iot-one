#include "connectivity/WifiManager.h"

#include <esp_wifi.h>

#include "config/Defaults.h"

namespace connectivity {
namespace {

void ApplyTxPower() { esp_wifi_set_max_tx_power(34); }

#ifdef JENIX_PROV_V2
void SyncNetworkConfigFromDriver(storage::ConfigStore& store, systemlog::Logger& logger) {
  const config::NetworkConfig cached = store.Network();
  if (cached.configured) return;

  wifi_config_t wifiConfig{};
  if (esp_wifi_get_config(WIFI_IF_STA, &wifiConfig) != ESP_OK) return;
  if (wifiConfig.sta.ssid[0] == '\0') return;

  const String ssid(reinterpret_cast<const char*>(wifiConfig.sta.ssid));
  const String password(reinterpret_cast<const char*>(wifiConfig.sta.password));
  if (store.SaveNetwork(ssid, password)) {
    logger.Info(String("Synced saved Wi-Fi credentials from ESP-IDF NVS SSID ") + ssid);
  }
}
#endif

}  // namespace

void WifiManager::Begin() {
#ifdef JENIX_PROV_V2
  WiFi.persistent(true);
  WiFi.mode(WIFI_STA);
  ApplyTxPower();
#else
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  WiFi.disconnect(true, true);
  delay(100);
  WiFi.mode(WIFI_OFF);
  delay(50);
#endif
  WiFi.setSleep(false);
  WiFi.setHostname(identity_.MdnsHost().c_str());
#ifdef JENIX_PROV_V2
  WiFi.setAutoReconnect(true);
  SyncNetworkConfigFromDriver(store_, logger_);
  if (store_.Network().configured) {
    StartStation(false);
  } else {
    logger_.Info("Prov2 build waiting for Espressif BLE provisioning");
  }
#else
  if (store_.Network().configured) {
    StartStation(true);
  } else {
    StartProvisioningAp(true);
  }
#endif
}

void WifiManager::Tick(uint32_t nowMs) {
  if (Connected()) {
    if (!lastConnected_) logger_.Info(String("Wi-Fi connected ip=") + WiFi.localIP().toString());
    lastConnected_ = true;
#ifndef JENIX_PROV_V2
    if (apActive_ && !stickyAp_) StopProvisioningAp();
#endif
    return;
  }
  lastConnected_ = false;
#ifndef JENIX_PROV_V2
  if (store_.Network().configured && !apActive_ &&
      nowMs - connectStartedAtMs_ >= config::kWifiConnectTimeoutMs) {
    logger_.Warn("Wi-Fi connect timeout, enabling provisioning AP");
    StartProvisioningAp(false);
    return;
  }
#endif
  if (store_.Network().configured && nowMs - connectStartedAtMs_ >= config::kWifiReconnectMs) {
    logger_.Info("Retrying Wi-Fi station connection");
    StartStation(
#ifdef JENIX_PROV_V2
        false
#else
        true
#endif
    );
  }
}

bool WifiManager::SaveAndReconnect(const String& ssid, const String& password) {
  if (!store_.SaveNetwork(ssid, password)) return false;
  if (ssid.isEmpty()) {
#ifdef JENIX_PROV_V2
    WiFi.disconnect(false, true);
    delay(50);
    WiFi.mode(WIFI_STA);
    ApplyTxPower();
    apActive_ = false;
    stickyAp_ = false;
    logger_.Info("Cleared Wi-Fi credentials and returned to BLE provisioning mode");
#else
    StartProvisioningAp(true, true);
#endif
    return true;
  }
  StartStation(
#ifdef JENIX_PROV_V2
      false
#else
      true
#endif
  );
  return true;
}

bool WifiManager::ClearSavedNetwork() { return SaveAndReconnect("", ""); }

void WifiManager::StartProvisioningAp(bool sticky, bool forceRestart) {
#ifdef JENIX_PROV_V2
  (void)sticky;
  if (forceRestart) {
    WiFi.disconnect(false, false);
    delay(50);
  }
  WiFi.mode(WIFI_STA);
  ApplyTxPower();
  apActive_ = false;
  stickyAp_ = false;
  logger_.Info("Prov2 build uses Espressif BLE provisioning; SoftAP not started");
#else
  stickyAp_ = sticky || !store_.Network().configured;
  WiFi.mode(store_.Network().configured ? WIFI_AP_STA : WIFI_AP);
  ApplyTxPower();
  if (forceRestart && apActive_) {
    WiFi.softAPdisconnect(true);
    delay(50);
  }
  if (forceRestart || !apActive_) apActive_ = WiFi.softAP(identity_.ApSsid().c_str());
  logger_.Info(String("Provisioning AP ") + (apActive_ ? "ready " : "failed ") +
               identity_.ApSsid());
#endif
}

bool WifiManager::Connected() const { return WiFi.status() == WL_CONNECTED; }

String WifiManager::LocalIp() const {
  if (Connected()) return WiFi.localIP().toString();
  if (apActive_) return WiFi.softAPIP().toString();
  return "";
}

String WifiManager::StationSsid() const { return Connected() ? WiFi.SSID() : ""; }

void WifiManager::FillJson(JsonObject object) const {
  object["connected"] = Connected();
  object["configured"] = store_.Network().configured != 0;
  object["apActive"] = apActive_;
  object["ip"] = LocalIp();
  object["ssid"] = Connected() ? WiFi.SSID() : (apActive_ ? identity_.ApSsid() : "");
  object["rssi"] = Connected() ? WiFi.RSSI() : 0;
}

void WifiManager::StartStation(bool keepRecoveryAp) {
  connectStartedAtMs_ = millis();
#ifdef JENIX_PROV_V2
  (void)keepRecoveryAp;
  apActive_ = false;
  stickyAp_ = false;
  WiFi.mode(WIFI_STA);
  ApplyTxPower();
  WiFi.begin(store_.Network().ssid, store_.Network().password);
  logger_.Info(String("Connecting to Wi-Fi SSID ") + store_.Network().ssid);
#else
  if (keepRecoveryAp) {
    StartProvisioningAp(false, false);
    logger_.Info("Keeping provisioning AP available during Wi-Fi connection attempt");
  } else {
    if (apActive_) {
      WiFi.softAPdisconnect(true);
      apActive_ = false;
    }
    stickyAp_ = false;
    WiFi.mode(WIFI_STA);
    ApplyTxPower();
    logger_.Info("Provisioning AP hidden while applying Wi-Fi credentials");
  }
  WiFi.begin(store_.Network().ssid, store_.Network().password);
  logger_.Info(String("Connecting to Wi-Fi SSID ") + store_.Network().ssid);
#endif
}

void WifiManager::StopProvisioningAp() {
  WiFi.softAPdisconnect(true);
  apActive_ = false;
  stickyAp_ = false;
  WiFi.mode(WIFI_STA);
  ApplyTxPower();
  logger_.Info("Provisioning AP stopped");
}

}  // namespace connectivity
