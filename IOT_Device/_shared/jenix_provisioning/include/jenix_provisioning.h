#pragma once

#include <stdbool.h>
#include <stddef.h>

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

// Shared BLE + SoftAP + Security-Scheme-2 (SRP6a / AES-256-GCM) Wi-Fi
// provisioning, per ../../../PROVISIONING.md Sections 1-3 and 8a. Every
// Jenix One device is meant to consume this instead of a per-device
// bespoke copy -- see Section 8a for the reuse requirement this component
// exists to satisfy.
//
// Parameterized by exactly the four things Section 8a specifies: product
// code, PID, a Proof-of-Possession source, and (once the platform side
// exists) a bind endpoint. There is no bind-endpoint parameter yet: the
// platform's real claim/bind REST contract is not implemented anywhere in
// this repo as of 2026-09 (confirmed against both QRunlock's
// CloudBridgeService and the app's provisioningApi.ts) -- callers get
// device_id/ip via on_wifi_connected and decide what to do with it
// themselves, the same shape QRunlock's own CloudBridgeService already
// uses. Add a real bind_endpoint field here once that contract exists,
// rather than inventing one now.

typedef enum {
  JENIX_PROV_SCHEME_BLE = 0,
  JENIX_PROV_SCHEME_SOFTAP = 1,
} jenix_provisioning_scheme_t;

typedef struct {
  // 2-4 letters, no clash with PROVISIONING.md Section 2's table (e.g. "SB", "QRU").
  const char* product_code;
  // Platform product id string (e.g. "JNX-SB-S3-001").
  const char* pid;
  // Per-device secret authenticating the SRP6a handshake (Section 3 Phase 2).
  // NULL or empty => first-boot-generate, persist to this component's own
  // NVS namespace, and log to stdout for bench use -- the same interim
  // pattern QRunlock's pilot uses (PROVISIONING.md Section 7), acceptable
  // until a manufacturing-time burn step exists. Pass a real burned value
  // here once that exists.
  const char* proof_of_possession;
  // JENIX_PROV_SCHEME_SOFTAP only: an existing httpd_handle_t (cast to
  // void*) to register the provisioning HTTP endpoints on, instead of
  // starting a second httpd server -- the SoftAP scheme's own AP interface
  // still gets (re)configured with the standard JNX{code}{mac} SSID, but
  // sharing the handle lets a device's own diagnostic HTTP routes keep
  // working on the same server (Espressif's documented
  // wifi_prov_scheme_softap_set_httpd_handle() reuse pattern). NULL => let
  // the SoftAP scheme start its own httpd (fine if the caller has no
  // existing one to share). Ignored for JENIX_PROV_SCHEME_BLE.
  void* softap_httpd_handle;
} jenix_provisioning_config_t;

typedef struct {
  // Fired once after Wi-Fi credentials are applied and the station gets an
  // IP (Section 3 Phase 3 end / Phase 4 start). device_id is the standard
  // JNX{product_code}{6-hex-STA-MAC} name (Section 2); ip is the dotted
  // station address. Both pointers are only valid for the duration of the
  // call.
  void (*on_wifi_connected)(const char* device_id, const char* ip, void* ctx);
} jenix_provisioning_callbacks_t;

// Starts wifi_provisioning + protocomm on the requested transport,
// advertised as JNX{product_code}{6-hex-STA-MAC}. Per Section 3 Phase 0,
// callers must check for already-stored Wi-Fi station credentials
// themselves and skip calling this entirely when found -- this function
// does not make that check, it only implements Phases 1-3.
//
// wifi_prov_mgr is a true Espressif singleton (one static context, one
// scheme at a time) -- there is no supported way to run BLE and SoftAP
// simultaneously in one session (confirmed against ESP-IDF's own
// manager.c and its reference wifi_prov_mgr example, which picks a scheme
// at build time). Calling this with a *different* scheme than whatever is
// currently active switches to it (stops/deinits the old one first, then
// starts the new one) rather than failing -- e.g. a device offering BLE by
// default can switch to SoftAP on some other trigger (a button, in School
// Bell's case) without the caller needing to sequence stop()+start() itself.
esp_err_t jenix_provisioning_start(jenix_provisioning_scheme_t scheme,
                                    const jenix_provisioning_config_t* config,
                                    const jenix_provisioning_callbacks_t* callbacks,
                                    void* callback_ctx);

// Stops and deinitializes the provisioning manager if running. Safe to call
// when not active.
void jenix_provisioning_stop(void);

bool jenix_provisioning_is_active(void);

// Builds the standard JNX{product_code}{6-hex-STA-MAC} name (Section 2) into
// out. out_len must be at least 14 bytes ("JNX" + up to 4 + 6 + nul).
esp_err_t jenix_provisioning_build_name(const char* product_code, char* out, size_t out_len);

#ifdef __cplusplus
}
#endif
