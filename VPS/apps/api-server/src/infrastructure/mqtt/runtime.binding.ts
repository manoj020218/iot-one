import type { RuntimeMqttBridge } from "./runtime.types";

let activeRuntimeMqttBridge: RuntimeMqttBridge | null = null;

export function useRuntimeMqttBridge(bridge: RuntimeMqttBridge | null) {
  activeRuntimeMqttBridge = bridge;
}

export function getRuntimeMqttBridge(): RuntimeMqttBridge | null {
  return activeRuntimeMqttBridge;
}
