import type { WifiCredentialPayload } from "../../provisioning.types";
import { WifiCredentialForm } from "../../components/WifiCredentialForm";
import type { ApSetupDescriptor } from "../services/apProvisioningService";

export interface ApWifiFormProps {
  descriptor: ApSetupDescriptor;
  loading?: boolean;
  detectedSsid?: string | null;
  detectingSsid?: boolean;
  onRefreshDetectedSsid?: () => void;
  onSubmit: (payload: WifiCredentialPayload) => Promise<void> | void;
}

export function ApWifiForm({
  descriptor,
  loading = false,
  detectedSsid,
  detectingSsid,
  onRefreshDetectedSsid,
  onSubmit
}: ApWifiFormProps) {
  return (
    <WifiCredentialForm
      appearance="ap"
      description={`${descriptor.apSsid} will pass this network to the device for cloud onboarding.`}
      detectedSsid={detectedSsid}
      detectingSsid={detectingSsid}
      loading={loading}
      onRefreshDetectedSsid={onRefreshDetectedSsid}
      onSubmit={onSubmit}
      submitLabel="Send credentials through AP mode"
      title="Send your site Wi-Fi"
    />
  );
}
