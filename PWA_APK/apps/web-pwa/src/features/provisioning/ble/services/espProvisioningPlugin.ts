/**
 * TypeScript-facing wrapper for EspProvisioningPlugin.java (native Android),
 * which wraps Espressif's esp-idf-provisioning-android SDK -- the real
 * protocomm + Security Scheme 2 (SRP6a) BLE wire protocol QRunlock's prov2
 * firmware speaks. See QRunlock/PROVISIONING.md Section 10 and
 * BleProvisioningService.cpp for the protocol details this plugin implements
 * natively instead of in JS.
 */

export interface EspProvisioningConnectOptions {
  macAddress: string;
  serviceUuid: string;
}

export interface EspProvisioningProvisionOptions {
  username: string;
  pop: string;
  ssid: string;
  passphrase: string;
}

export type EspProvisioningStage =
  | "wifiConfigSent"
  | "wifiConfigApplied";

export interface EspProvisioningProgressEvent {
  stage: EspProvisioningStage;
}

export interface EspProvisioningListenerHandle {
  remove: () => Promise<void> | void;
}

export interface NativeEspProvisioningPlugin {
  connect: (options: EspProvisioningConnectOptions) => Promise<{ connected: boolean }>;
  provision: (options: EspProvisioningProvisionOptions) => Promise<{ success: boolean }>;
  disconnect: () => Promise<void>;
  addListener: (
    eventName: "provisioningProgress",
    listener: (event: EspProvisioningProgressEvent) => void
  ) => Promise<EspProvisioningListenerHandle>;
}

export function getEspProvisioningPlugin(): NativeEspProvisioningPlugin | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = (
    window as Window & {
      Capacitor?: {
        Plugins?: {
          EspProvisioning?: NativeEspProvisioningPlugin;
        };
      };
    }
  ).Capacitor?.Plugins?.EspProvisioning;

  return candidate ?? null;
}
