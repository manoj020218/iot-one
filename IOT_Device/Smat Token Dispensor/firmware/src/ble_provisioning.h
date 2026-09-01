#pragma once
#include <Arduino.h>

// ---------------------------------------------------------------------------
// ble_provisioning — NimBLE-based WiFi + tenant provisioning
//
// Advertises as "JNX-TD-XXXX" (XXXX = last 4 hex chars of MAC).
// Exposes a GATT service with two writable characteristics:
//   0x1234 — WiFi credentials JSON: {"ssid":"...","pass":"..."}
//   0x1235 — Home binding JSON:     {"homeId":"...","siteName":"...","token":"..."}
//                                    Legacy {"tenantId":"...","siteId":"..."} is
//                                    still accepted and migrated into the same fields.
//
// Active only for BLE_WINDOW_MS after boot (or until provisioned).
// ---------------------------------------------------------------------------

#define BLE_WINDOW_MS  120000   // 2 minutes

namespace BleProvisioning {
    void begin();
    void stop();

    bool isActive();
    bool isProvisioned(); // True once WiFi credentials received and saved
}
