import type { AuthSession } from "@jenix/shared";
import type { ComponentType } from "react";

/**
 * Props for a product-level remote package — a whole mounted sub-app
 * (its own internal navigation, multiple sections) as opposed to
 * DevicePackageComponent, which renders one card for one claimed device.
 * See RemoteProductMount for the host-side consumer.
 */
export interface RemoteProductPackageProps {
  session: AuthSession;
  homeId: string;
}

export type RemoteProductPackageComponent = ComponentType<RemoteProductPackageProps>;
