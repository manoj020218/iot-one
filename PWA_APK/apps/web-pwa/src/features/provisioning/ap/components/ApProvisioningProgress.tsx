import type { ProvisioningProgressModel } from "../../provisioning.types";
import { ProvisioningProgress } from "../../components/ProvisioningProgress";
import type { ApSetupDescriptor } from "../services/apProvisioningService";

export interface ApProvisioningProgressProps {
  descriptor: ApSetupDescriptor;
  progress: ProvisioningProgressModel;
  error?: string | null | undefined;
}

export function ApProvisioningProgress({
  descriptor,
  progress,
  error
}: ApProvisioningProgressProps) {
  return (
    <ProvisioningProgress
      appearance="ap"
      description={`Moving ${descriptor.productName} from hotspot mode into Wi-Fi, cloud, and MQTT connectivity.`}
      error={error}
      progress={progress}
      title={`Connecting ${descriptor.productName}`}
    />
  );
}
