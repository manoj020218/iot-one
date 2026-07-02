import { useState } from "react";

import type { BleScanDevice } from "../../provisioning.types";
import {
  getBleDiscoveryMode,
  scanBleDevices,
  type BleDiscoveryMode
} from "../services/bleDiscoveryService";

export function useBleScan() {
  const [enabled, setEnabled] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<BleScanDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mode: BleDiscoveryMode = getBleDiscoveryMode();
  const supported = mode === "native";

  async function refresh() {
    setScanning(true);
    setError(null);

    try {
      setDevices(await scanBleDevices());
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : "Unable to scan nearby BLE devices."
      );
    } finally {
      setScanning(false);
    }
  }

  async function enable() {
    setEnabled(true);
    await refresh();
  }

  return {
    mode,
    supported,
    enabled,
    scanning,
    devices,
    error,
    enable,
    refresh
  };
}
