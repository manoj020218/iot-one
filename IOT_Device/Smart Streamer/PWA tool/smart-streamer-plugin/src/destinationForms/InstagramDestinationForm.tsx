import { React } from "../host";
import { TextField, ReadOnlyField } from "../components/FormFields";
import type { StreamerDestinationSummary } from "../demoDestinations";

interface InstagramDestinationFormProps {
  existing: StreamerDestinationSummary | undefined;
}

export function InstagramDestinationForm({ existing }: InstagramDestinationFormProps) {
  const [profileName, setProfileName] = React.useState(existing?.displayName ?? "");
  const [accountLabel, setAccountLabel] = React.useState("");
  const [serverUrl, setServerUrl] = React.useState("");
  const [streamKey, setStreamKey] = React.useState("");
  const [expiry, setExpiry] = React.useState(existing?.credentialExpiry ?? "");

  return (
    <>
      <p className="hint-text" style={{ marginBottom: 12, fontWeight: 600 }}>
        Instagram stream credentials may be temporary. Update and validate the server URL
        and stream key before the scheduled broadcast.
      </p>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <TextField label="Profile Name" onChange={setProfileName} value={profileName} />
        <TextField label="Instagram Account Label" onChange={setAccountLabel} value={accountLabel} />
        <TextField label="Live Producer Server URL" onChange={setServerUrl} value={serverUrl} />
        <TextField
          label="Temporary Stream Key"
          onChange={setStreamKey}
          placeholder={existing?.hasStreamKey ? "•••••••• (leave blank to keep)" : "Temporary key"}
          type="password"
          value={streamKey}
        />
        <TextField label="Credential Expiry" onChange={setExpiry} placeholder="YYYY-MM-DDTHH:mm:ssZ" value={expiry} />
        <ReadOnlyField label="Last Updated" value={existing?.lastValidatedAt ?? "Never updated"} />
      </div>
    </>
  );
}
