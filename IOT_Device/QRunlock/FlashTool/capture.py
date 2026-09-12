"""Serial boot-log capture for the factory flash tool.

Opens the device's serial port directly (no PlatformIO monitor involved,
since chaining through `pio -t monitor` after an upload has a multi-second
process handoff gap that reliably misses the boot lines we need) and reads
the first few seconds of boot output, extracting the fields a factory
record needs: the BLE service name, the Security Scheme 2 PoP, and the
local API token.
"""

import re
import time

import serial

TOKEN_RE = re.compile(
    r"\[SECURITY\] (?:"
    r"Generated local API token header \S+ value (?P<token_a>\S+)"
    r"|Local API token source=\S+ header=\S+ value=(?P<token_b>\S+)"
    r")"
)
POP_RE = re.compile(
    r"\[PROVISIONING\] Security2 username (?P<username>\S+) "
    r"PoP source=\S+ value=(?P<pop>\S+)"
)
BOOT_RE = re.compile(
    r"Boot PID=(?P<pid>\S+) AP/BLE=(?P<ble_name>\S+) CPU=(?P<cpu>\S+)"
)
# Shared jenix_provisioning component's own line (IOT_Device/_shared/jenix_provisioning) --
# every device built on that component prints this once per boot while
# unprovisioned, regardless of whether its PoP was just generated or loaded
# from a previous boot (unlike the QRunlock-specific patterns above, which
# only ever fire once, on first-ever generation).
FACTORY_RE = re.compile(
    r"\[FACTORY\] pid=(?P<pid>\S+) ble_name=(?P<ble_name>\S+) "
    r"pop_username=(?P<username>\S+) pop=(?P<pop>\S+)"
)

# QRunlock/Token Dispenser's own local HTTP API auth token concept -- not
# every product has this (the shared jenix_provisioning component doesn't
# produce one), so it's excluded from the default required set. Pass
# `required_fields=FULL_FIELDS` explicitly for models that do have it.
FULL_FIELDS = ("token", "pop", "username", "pid", "ble_name")
DEFAULT_REQUIRED_FIELDS = ("pop", "username", "pid", "ble_name")


def _parse_line(line, record):
    m = TOKEN_RE.search(line)
    if m:
        record["token"] = m.group("token_a") or m.group("token_b")
        return

    m = FACTORY_RE.search(line)
    if m:
        record["pid"] = m.group("pid")
        record["ble_name"] = m.group("ble_name")
        record["username"] = m.group("username")
        record["pop"] = m.group("pop")
        return

    m = POP_RE.search(line)
    if m:
        record["pop"] = m.group("pop")
        record["username"] = m.group("username")
        return

    m = BOOT_RE.search(line)
    if m:
        record["pid"] = m.group("pid")
        record["ble_name"] = m.group("ble_name")
        return


def capture_boot_record(port, baud=115200, timeout_s=60, required_fields=DEFAULT_REQUIRED_FIELDS):
    """Read boot output from `port` for up to `timeout_s` seconds.

    Returns (record, raw_lines). `record` has whatever of `required_fields`
    was found; missing keys mean that line never appeared in the window.

    60s (not 8s) because on a genuinely fresh/erased chip, Token Dispenser's
    real reset-to-BLE-advertising time measured ~42.5s on real hardware:
    two Preferences::begin() calls on not-yet-existent namespaces each
    block ~5s before failing (~11s total), then wifi_prov_mgr's BLE/NimBLE
    stack bring-up itself takes another ~20-30s wall-clock. QRunlock's own
    boot has none of this, so a longer window only makes its capture more
    generous, not slower in practice.
    """
    record = {}
    raw_lines = []

    ser = serial.Serial()
    ser.port = port
    ser.baudrate = baud
    ser.timeout = 0.2
    ser.open()
    try:
        buf = b""
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            if all(field in record for field in required_fields):
                break
            chunk = ser.read(4096)
            if not chunk:
                continue
            buf += chunk
            while b"\n" in buf:
                raw, buf = buf.split(b"\n", 1)
                line = raw.decode(errors="replace").rstrip("\r")
                if line:
                    raw_lines.append(line)
                    _parse_line(line, record)
    finally:
        ser.close()

    return record, raw_lines


def missing_fields(record, required_fields=DEFAULT_REQUIRED_FIELDS):
    return [f for f in required_fields if f not in record]
