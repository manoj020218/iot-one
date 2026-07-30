import { describe, expect, it, vi } from "vitest";

import {
  isCloudStatusResponse,
  isHelloResponse,
  isSetWifiResponse,
  isWifiScanResponse,
  sendJsonCommand,
  type NativeBleClient
} from "./bleProtocol";

function textToDataView(text: string): DataView {
  const bytes = new TextEncoder().encode(text);
  return new DataView(bytes.buffer);
}

function createPlugin(reads: string[]) {
  const queue = [...reads];
  return {
    write: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockImplementation(async () => {
      const next = queue.shift() ?? reads[reads.length - 1]!;
      return textToDataView(next);
    })
  } as unknown as NativeBleClient;
}

describe("sendJsonCommand", () => {
  it("writes the command and resolves once a matching response is read back", async () => {
    const ble = createPlugin([
      '{"ok":true,"cmd":"ready"}',
      '{"ok":true,"cmd":"hello","pid":"JNX-TG-C3-001","wifi_connected":false}'
    ]);

    const result = await sendJsonCommand(ble, "AA:BB", { cmd: "hello" }, {
      timeoutMs: 2000,
      validate: isHelloResponse
    });

    expect(ble.write).toHaveBeenCalledTimes(1);
    expect(result.pid).toBe("JNX-TG-C3-001");
  });

  it("keeps polling past a stale/unrelated response until the expected shape appears", async () => {
    const ble = createPlugin([
      '{"ok":true,"cmd":"ready"}',
      '{"ok":true,"cmd":"hello","wifi_connected":false}',
      '{"ok":true,"cmd":"set_wifi","wifi_connected":true,"ip":"192.168.1.42"}'
    ]);

    const result = await sendJsonCommand(
      ble,
      "AA:BB",
      { cmd: "set_wifi", ssid: "Net", password: "pw" },
      { timeoutMs: 2000, validate: isSetWifiResponse }
    );

    expect(result.wifi_connected).toBe(true);
    expect(result.ip).toBe("192.168.1.42");
  });

  it("throws immediately when the device returns an explicit error response", async () => {
    const ble = createPlugin(['{"ok":false,"error":"ssid_required"}']);

    await expect(
      sendJsonCommand(ble, "AA:BB", { cmd: "set_wifi" }, {
        timeoutMs: 2000,
        validate: isSetWifiResponse
      })
    ).rejects.toThrow("ssid_required");
  });

  it("times out if no matching response ever arrives", async () => {
    const ble = createPlugin(['{"ok":true,"cmd":"ready"}']);

    await expect(
      sendJsonCommand(ble, "AA:BB", { cmd: "hello" }, {
        timeoutMs: 300,
        validate: isHelloResponse
      })
    ).rejects.toThrow(/did not respond/);
  });

  it("tolerates a corrupt/partial read (invalid JSON) and keeps polling", async () => {
    const ble = createPlugin([
      "{not valid json",
      '{"ok":true,"cmd":"hello","wifi_connected":false}'
    ]);

    const result = await sendJsonCommand(ble, "AA:BB", { cmd: "hello" }, {
      timeoutMs: 2000,
      validate: isHelloResponse
    });

    expect(result.cmd).toBe("hello");
  });
});

describe("response validators", () => {
  it("accept only their own shape", () => {
    expect(isHelloResponse({ ok: true, cmd: "hello", wifi_connected: false })).toBe(true);
    expect(isHelloResponse({ ok: true, cmd: "set_wifi" })).toBe(false);

    expect(isWifiScanResponse({ ok: true, cmd: "scan_wifi", networks: [] })).toBe(true);
    expect(isWifiScanResponse({ ok: true, cmd: "scan_wifi" })).toBe(false);

    expect(isSetWifiResponse({ ok: true, cmd: "set_wifi", wifi_connected: true })).toBe(true);
    expect(isSetWifiResponse({ ok: true, cmd: "hello" })).toBe(false);

    expect(isCloudStatusResponse({ ok: true, cmd: "c", wifi_connected: true, mqtt_connected: false })).toBe(true);
    expect(isCloudStatusResponse({ ok: true, cmd: "set_wifi" })).toBe(false);
  });
});
