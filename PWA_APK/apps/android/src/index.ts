import { platformIdentity } from "@jenix/shared";

export interface CapacitorShellConfig {
  appId: string;
  appName: string;
  webDir: string;
  bundledWebRuntime: boolean;
}

export const androidShellConfig: CapacitorShellConfig = {
  appId: "in.iotsoft.jenix.one",
  appName: platformIdentity.appName,
  webDir: "../web-pwa/dist",
  bundledWebRuntime: false
};
