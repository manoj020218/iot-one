# Jenix Smart Token Dispenser Firmware
## PID: JNX-TD-C3-01 | v1.0.0 | Jenix One IoT Platform

Production-grade firmware for the **ESP32-C3 Super Mini (HW-466AB)** running a CSN-A1X
thermal printer. Integrates fully with the Jenix One IoT platform via MQTT, BLE provisioning,
and the PWA/APK app.

---

## Hardware

| Component | Details |
|-----------|---------|
| MCU | ESP32-C3 Super Mini (HW-466AB), 4 MB flash |
| Printer | CSN-A1X thermal panel printer (ESC/POS, 9600 baud TTL) |
| Button | Single touch/push button (active LOW) |
| LED | Status LED (active LOW on most C3 Mini boards) |
| Power | 3.3 V logic; printer needs separate 5 V / 9 V / 12 V supply |

---

## Wiring

```
                   ESP32-C3 Super Mini (HW-466AB)
                   ┌─────────────────────────────┐
                   │  USB-C (to PC for flashing)  │
                   │                              │
          GND ─────┤ GND              GPIO8 ──────┼── Status LED (→ 330Ω → GND)
      3.3V Vcc ────┤ 3V3              GPIO9 ──────┼── Button (other side → GND)
                   │                              │
  Printer RX ──────┼── GPIO6 (UART1 TX)           │   (3.3V TTL → Printer OK)
                   │                              │
  Printer TX ──────┼── GPIO7 (UART1 RX)           │   ⚠ If printer TX is 5V TTL:
     ┌─ 10kΩ ──── 3V3                              │     Use voltage divider or
     └─ 20kΩ ──── GND                              │     level-shifter into GPIO7!
                   │                              │
     Buzzer (+) ───┼── GPIO4 (optional)           │
     Buzzer (-) ───┼── GND                        │
                   └─────────────────────────────┘

Printer Power Supply (SEPARATE from ESP32):
  ┌─ Printer VCC ← 5 V / 9 V / 12 V (per CSN-A1X model)
  │  Add 1000 µF capacitor close to printer VCC/GND pins.
  └─ Printer GND ← Common GND with ESP32.

⚠ DO NOT power the printer from the ESP32 board regulator!
```

### Pin Summary

| GPIO | Function | Notes |
|------|----------|-------|
| GPIO4 | Buzzer (optional) | Via NPN transistor or active-low |
| GPIO5 | External button alt | If not using built-in boot button |
| GPIO6 | UART1 TX → Printer RX | 3.3 V TTL OK |
| GPIO7 | UART1 RX ← Printer TX | Level-shift if printer is 5 V |
| GPIO8 | Status LED (active LOW) | Built-in on most C3 Mini boards |
| GPIO9 | Token button (active LOW) | Built-in BOOT button |
| GPIO18 | USB D− | Reserved — do not use |
| GPIO19 | USB D+ | Reserved — do not use |

---

## First Flash (PlatformIO)

```bash
# 1. Install PlatformIO (VS Code extension or CLI)
# 2. Connect ESP32-C3 via USB-C

# Build and flash firmware
pio run -e jenix-td-c3 -t upload

# Upload web UI and templates to SPIFFS
pio run -e jenix-td-c3 -t uploadfs

# Monitor serial output
pio device monitor -b 115200
```

---

## Provisioning (First Boot)

### Option A — BLE (Mobile App)
1. Open Jenix One app → Add Device → Scan for `JNX-TD-XXXX`
2. Send WiFi credentials + tenant binding JSON.
3. Device saves config to NVS and restarts.

BLE is active for **2 minutes** after boot then stops to save RF resources.

### Option B — AP Mode (Browser)
1. Connect phone/laptop to WiFi: `JNX-TD-XXXX` (open, no password).
2. Open `http://192.168.4.1` in browser.
3. Login → Configuration → Network → Enter WiFi + MQTT details → Save.
4. Reboot device.

Default credentials: **admin / jenix1234** (change immediately in Configuration).

---

## OTA Updates

### Local (PlatformIO)
```bash
# Set upload_port in platformio.ini [env:jenix-td-c3-ota]
pio run -e jenix-td-c3-ota -t upload
```

### Remote (MQTT command)
```json
{
  "command": "OTA_UPDATE",
  "command_id": "cmd-uuid-001",
  "url": "https://updates.yourserver.com/jnx-td-c3-v1.1.0.bin"
}
```

### Web UI
Configuration → OTA → Enter firmware URL → Start OTA Update.

---

## MQTT Topics

| Topic | Direction | Purpose |
|-------|-----------|---------|
| `jenix/{tenant}/{site}/{device}/telemetry` | Device → Cloud | Periodic status |
| `jenix/{tenant}/{site}/{device}/state` | Device → Cloud | Retained presence/status |
| `jenix/{tenant}/{site}/{device}/command` | Cloud → Device | Commands |
| `jenix/{tenant}/{site}/{device}/event` | Device → Cloud | Events & ACKs |

---

## MQTT Payload Examples

### Telemetry (device → cloud, every 30 s)
```json
{
  "deviceId": "JNX-AABBCCDDEEFF",
  "pid": "JNX-TD-C3-01",
  "ts": 1751500000,
  "currentToken": 42,
  "lastPrintedToken": 42,
  "printerState": 0,
  "paperLow": false,
  "estimatedTokensLeft": 458,
  "paperOut": false,
  "wifi_rssi": -62,
  "uptime_sec": 3600,
  "firmware_version": "v1.0.0"
}
```

### Command — Print Next Token
```json
{
  "command": "PRINT_NEXT_TOKEN",
  "command_id": "a1b2c3d4-0000-0000-0000-000000000001"
}
```

### Command — Print Custom JSON
```json
{
  "command": "PRINT_CUSTOM_JSON",
  "command_id": "a1b2c3d4-0000-0000-0000-000000000002",
  "payload": "{\"elements\":[{\"type\":\"text\",\"content\":\"Appointment\",\"align\":1,\"bold\":true}]}"
}
```

### Command — Set Token Counter
```json
{
  "command": "SET_TOKEN_COUNTER",
  "command_id": "a1b2c3d4-0000-0000-0000-000000000003",
  "value": 0
}
```

### Command — Set Template
```json
{
  "command": "SET_TEMPLATE",
  "command_id": "a1b2c3d4-0000-0000-0000-000000000004",
  "template": "{...full print_template.json content...}"
}
```

### Command — Factory Reset
```json
{
  "command": "FACTORY_RESET",
  "command_id": "a1b2c3d4-0000-0000-0000-000000000005"
}
```

### ACK (device → cloud, event topic)
```json
{
  "command_id": "a1b2c3d4-0000-0000-0000-000000000001",
  "success": true,
  "reason": "queued"
}
```

### Paper Low Alert (device → cloud, event topic)
```json
{
  "type": "PAPER_LOW",
  "estimatedTokensLeft": 48
}
```

---

## Local Web UI

| URL | Description |
|-----|-------------|
| `http://{device-ip}/` | Status dashboard (polling, no login required for view) |
| `http://{device-ip}/config.html` | Configuration panel (login required) |
| `http://{device-ip}/api/status` | JSON status endpoint |
| `http://{device-ip}/api/logs` | Event log JSON download |
| `http://192.168.4.1/` | AP mode (when WiFi not configured) |

---

## Button Behaviour

| Press | Action |
|-------|--------|
| Short press (<5 s) | Generate and print next token |
| Hold 5 s | Test print |
| Hold 10 s | Reset paper roll counter *(must be enabled in config)* |

---

## State Machine

```
IDLE → PRINT_REQUESTED → PRINTING → PRINT_SUCCESS → IDLE
                                  → PRINT_FAILED  → IDLE
                                  → PAPER_OUT     → ERROR (blocks prints)
```

---

## ESP-NOW Local Broadcast

Every 10 seconds the device broadcasts a compact status struct to all local
ESP-NOW peers (`FF:FF:FF:FF:FF:FF`). A paired Jenix display or controller
can trigger a token dispense by sending a signed `EspNowCommand` struct with
matching `securityKey` (configured in Device Config or NVS key `jnx_dev/espNowKey`).

---

## FreeRTOS Tasks

| Task | Priority | Stack | Purpose |
|------|----------|-------|---------|
| `printer` | 4 (highest) | 4096 words | ESC/POS queue consumer |
| `button` | 3 | 2048 words | Debounce + press detection |
| `network` | 2 | 8192 words | WiFi reconnect, MQTT loop, OTA |
| `telemetry` | 1 | 4096 words | Periodic publish, ESP-NOW broadcast |

---

## Project Structure

```
firmware/
├── platformio.ini          Build config
├── partitions.csv          4 MB flash layout (OTA + SPIFFS)
├── scripts/
│   └── gen_build_info.py   Injects build timestamp
├── src/
│   ├── main.cpp            Entry point + FreeRTOS tasks
│   ├── version.h           Firmware version + pin defaults
│   ├── config_store.*      NVS-backed configuration
│   ├── token_manager.*     Persistent token counter
│   ├── printer_driver.*    ESC/POS UART driver
│   ├── print_template.*    JSON-driven template engine
│   ├── paper_estimator.*   Roll estimation
│   ├── event_log.*         Circular SPIFFS event log
│   ├── mqtt_client.*       MQTT + command handler
│   ├── http_fallback.*     HTTP POST fallback
│   ├── espnow_service.*    Local broadcast
│   ├── ble_provisioning.*  NimBLE WiFi provisioning
│   ├── ota_service.*       ArduinoOTA + HTTP OTA
│   └── local_webui.*       AsyncWebServer REST API
└── data/
    ├── print_template.json Default ESC/POS template
    └── www/
        ├── index.html      Status dashboard
        └── config.html     Configuration panel
```

---

## Notes for CSN-A1X

- Default baud: **9600** (set via ESC/POS init or DIP switch).
- Paper width: 58 mm thermal paper roll.
- Power: check your specific CSN-A1X variant (5 V or 9-12 V).
- Printer TX output is **5 V TTL** on most variants — use a voltage divider
  (10 kΩ + 20 kΩ to GND) or a level-shifter into ESP32-C3 GPIO7 (3.3 V max).
- Add **1000 µF** bulk capacitor on the printer power rail close to the connector.

---

## Platform Integration

This firmware implements the **Jenix One device contract**:
- PID `JNX-TD-C3-01` must be registered in the Jenix One admin panel.
- Telemetry schema matches `packages/device-schemas/src/telemetry/`.
- OTA is delivered via the Jenix One OTA module.
- BLE provisioning uses the same GATT profile as the Jenix PWA provisioning flow.

---

*Jenix One IoT Platform — © 2026 Jenix*
