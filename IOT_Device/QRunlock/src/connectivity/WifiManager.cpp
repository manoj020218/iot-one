#include "connectivity/WifiManager.h"

#include <esp_wifi.h>

#include "config/Defaults.h"

namespace connectivity {
namespace {

void ApplyTxPower() { esp_wifi_set_max_tx_power(34); }

}  // namespace

void WifiManager::Begin() {
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  WiFi.disconnect(true, true);
  delay(100);
  WiFi.mode(WIFI_OFF);
  delay(50);
  WiFi.setSleep(false);
  WiFi.setHostname(identity_.MdnsHost().c_str());
  if (store_.Network().configured) {
    StartStation(true);
  } else {
    StartProvisioningAp(true);
  }
}

void WifiManager::Tick(uint32_t nowMs) {
  if (Connected()) {
    if (!lastConnected_) logger_.Info(String("Wi-Fi connected ip=") + WiFi.localIP().toString());
    lastConnected_ = true;
    if (apActive_ && !stickyAp_) StopProvisioningAp();
    return;
  }
  lastConnected_ = false;
  if (store_.Network().configured && !apActive_ &&
      nowMs - connectStartedAtMs_ >= config::kWifiConnectTimeoutMs) {
    logger_.Warn("Wi-Fi connect timeout, enabling provisioning AP");
    StartProvisioningAp(false);
    return;
  }
  if (store_.Network().configured && nowMs - connectStartedAtMs_ >= config::kWifiReconnectMs) {
    logger_.Info("Retrying Wi-Fi station connection");
    StartStation(true);
  }
}

bool WifiManager::SaveAndReconnect(const String& ssid, const String& password) {
  if (!store_.SaveNetwork(ssid, password)) return false;
  if (ssid.isEmpty()) {
    StartProvisioningAp(true, true);
    return true;
  }
  StartStation(true);
  return true;
}

bool WifiManager::ClearSavedNetwork() { return SaveAndReconnect("", ""); }

void WifiManager::StartProvisioningAp(bool sticky, bool forceRestart) {
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
