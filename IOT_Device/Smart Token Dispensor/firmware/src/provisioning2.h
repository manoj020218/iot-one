#pragma once
#include <Arduino.h>

// ---------------------------------------------------------------------------
// provisioning2 — Espressif wifi_provisioning / protocomm, Security Scheme 2
// (SRP6a key exchange + AES-256-GCM), per PROVISIONING.md.
//
// Pilot scope (see PROVISIONING.md §7): BLE transport only, SoftAP transport
// deferred to a follow-up. Only built when JENIX_PROV_V2 is defined (the
// jenix-td-c3-prov2 PlatformIO env) — the production jenix-td-c3 env keeps
// using ble_provisioning.h/BleProvisioning unchanged.
//
// Advertises as JNXTD{6-hex-MAC} (PROVISIONING.md §2). The per-device
// Proof-of-Possession is auto-generated and persisted to NVS on first boot
// (no manufacturing-time PoP-burning tool exists yet) and printed to Serial
// + the event log so it can be read off during bench testing.
//
// Mirrors BleProvisioning's public surface so main.cpp only needs a
// compile-time swap, not a rewrite.
// ---------------------------------------------------------------------------

#define PROV2_BLE_WINDOW_MS  180000   // Bounded 3-minute commissioning window

namespace Provisioning2 {
    void begin();
    void stop();

    bool isActive();
    bool isProvisioned(); // True once WiFi credentials received and connected

    // The BLE service name advertised in begin() (JNXTD{6hex}) — empty until
    // begin() has run. Used for the factory-flash boot log line in main.cpp.
    const char* bleName();
}
