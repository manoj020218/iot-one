import { React } from "../host";
import { TextField, ReadOnlyField } from "../components/FormFields";
import type { StreamerDestinationSummary } from "../demoDestinations";

interface FacebookDestinationFormProps {
  existing: StreamerDestinationSummary | undefined;
}

export function FacebookDestinationForm({ existing }: FacebookDestinationFormProps) {
  const [profileName, setProfileName] = React.useState(existing?.displayName ?? "");
  const [pageName, setPageName] = React.useState("");
  const [serverUrl, setServerUrl] = React.useState("rtmps://live-api-s.facebook.com:443/rtmp/");
  const [streamKey, setStreamKey] = React.useState("");
  const [keyMode, setKeyMode] = React.useState<string>(existing?.credentialMode ?? "persistent");
  const [expiry, setExpiry] = React.useState(existing?.credentialExpiry ?? "");

  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
      <TextField label="Profile Name" onChange={setProfileName} value={profileName} />
      <TextField label="Page / Destination Name" onChange={setPageName} value={pageName} />
      <TextField label="RTMPS Server URL" onChange={setServerUrl} value={serverUrl} />
      <TextField
        label="Stream Key"
        onChange={setStreamKey}
        placeholder={existing?.hasStreamKey ? "•••••••• (leave blank to keep)" : "Persistent or temporary key"}
        type="password"
        value={streamKey}
      />
      <TextField label="Key Mode (persistent/temporary)" onChange={setKeyMode} value={keyMode} />
      <TextField label="Credential Expiry" onChange={setExpiry} placeholder="YYYY-MM-DDTHH:mm:ssZ" value={expiry} />
      <ReadOnlyField label="Last Validation" value={existing?.lastValidatedAt ?? "Never validated"} />
    </div>
  );
}
