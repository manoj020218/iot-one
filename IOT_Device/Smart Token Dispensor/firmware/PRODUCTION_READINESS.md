# Smart Token Dispenser - Production Readiness Review

Review date: 2026-09-17

Hardware: ESP32-C3 SuperMini HW-466AB

Firmware PID: JNX-TD-C3-01

## Verdict

**Not approved for production deployment yet.** The firmware is suitable for a controlled engineering pilot using the `jenix-td-c3-prov2` environment. The official ESP-IDF Security2 provisioning path and factory PoP capture are present, but the security, update, recovery, and reliability items below must be closed before an unattended field release.

## Completed in this review

- Added a dedicated factory FlashTool under `FlashTool/` for this product.
- The tool builds/flashes `jenix-td-c3-prov2`, performs a full erase, captures the factory serial record, and saves both JSON and a separate human-readable `_POP.txt` record.
- PoP is generated uniquely on the device and retained across a field factory reset.
- Wi-Fi credentials received over Security2 are staged and saved only after the ESP-IDF provisioning manager reports success. A wrong password can now be retried without replacing the last known-good credentials.
- Security2 BLE availability was reduced from the 15-minute bench setting to 3 minutes.
- Both PlatformIO environments were build-checked from current source. Hardware provisioning and printer endurance were not tested in this review.

## Release blockers

### P0 - security and recoverability

1. **The default build is still the legacy plaintext BLE implementation.** `jenix-td-c3-prov2` must become the only production factory target; the legacy environment must be labelled development-only or removed from the release process.
2. **MQTT control is plaintext.** It uses TCP/1883 without TLS or signed commands, although commands can print, reboot, factory-reset, and start OTA. Require TLS with server validation and per-device credentials; authenticate high-impact commands and prevent replay.
3. **OTA is neither authenticated nor rollback-safe.** The current HTTP updater does not pin/validate a trusted signer, and the prov2 partition table has one application slot. Implement signed firmware verification, A/B OTA partitions, boot validation, automatic rollback, and an interrupted-update test.
4. **The fallback AP and Web UI are not safely protected.** The AP is open and the initial Web UI login is a universal default over HTTP. Use a unique per-device setup secret, a limited setup window, forced credential replacement, and rate limiting.
5. **ESP-NOW command authentication is ineffective.** The default key is derived from the public MAC, the status frame sends the key in clear text, and commands have no nonce, MAC, encryption, or replay protection. Replace this protocol with authenticated encryption and per-device provisioned keys.
6. **Secure Boot, flash encryption, and protected secret storage are not enabled.** Define and validate a production eFuse/key-enrolment process before field release.

### P1 - functional correctness and field reliability

1. **Several JSON POST endpoints can respond twice.** The route handler sends an immediate response before the body callback authenticates and processes the request. Body callbacks also ignore `index`/`total`, so chunked requests can be parsed incompletely. Fix all affected configuration, token, template, and OTA routes and add request tests.
2. **Provisioning2 has no A/B firmware rollback path.** A valid build is not enough for safe remote updates on deployed devices.
3. **Print completion is not verified.** The printer task marks a job successful after transmitting bytes; the existing timeout value is unused and printer status/acknowledgement is not checked.
4. **Token allocation is not atomic with queueing.** A token can be persisted before queue submission; queue failure can skip numbers, and concurrent callers need serialization.
5. **Task creation and watchdog coverage are incomplete.** Check every task/queue creation result and monitor the printer path for stalls.
6. **Filesystem recovery can destroy configuration content.** `SPIFFS.begin(true)` permits formatting after a mount failure. Production recovery should preserve evidence and distinguish corruption from transient startup faults.
7. **Factory-reset identity semantics need a product decision.** PoP now remains stable, but reset currently clears the local API token and recreates device identity. Backend and factory-record behaviour must agree on which identifiers survive reset.

### P2 - release engineering

- Pin Git dependencies to immutable commit hashes and build in CI from a clean checkout.
- Correct the hardware documentation: the README button/LED pin table does not match the current firmware pin definitions.
- Escape structured log fields before emitting JSON.
- Resolve current compiler warnings and enforce warning/error policy for owned code.
- Add brownout, power-loss-during-print, low-paper, Wi-Fi loss, MQTT loss, repeated provisioning, 30-day soak, and factory-reset test records.
- Record source provenance only from a tracked clean tree. The current higher-level repository sees this renamed project directory as untracked, so a factory record could otherwise cite a commit that does not contain the exact source flashed.

## Production release gate

Release only after all P0 and P1 items are closed and evidence exists for:

- Unique PoP and application credential per serial number.
- Security2 provisioning from the supported mobile app, including wrong-password retry.
- Full erase and factory flash using the dedicated tool, with JSON and `_POP.txt` records archived.
- Signed A/B OTA success, interrupted OTA recovery, and rollback from a deliberately bad image.
- TLS MQTT authentication and rejection of replayed/forged commands.
- Printer endurance and power-interruption tests without duplicated or silently lost tokens.
- Locked production eFuses verified on sacrificial units before enabling them fleet-wide.

## Build evidence

| Environment | Intended use | Result on 2026-09-17 |
|---|---|---|
| `jenix-td-c3` | Legacy/development | PASS; RAM 76,316 bytes (23.3%), flash 1,357,992 bytes (86.3%) |
| `jenix-td-c3-prov2` | Security2 engineering pilot | PASS; RAM 68,536 bytes (20.9%), flash 1,556,586 bytes (49.5% of 3 MB single-app partition) |

No device was erased or flashed during this review.
