import { React } from "../host";
import { TextField, ReadOnlyField } from "../components/FormFields";
import type { StreamerDestinationSummary } from "../demoDestinations";

interface YouTubeDestinationFormProps {
  existing: StreamerDestinationSummary | undefined;
}

export function YouTubeDestinationForm({ existing }: YouTubeDestinationFormProps) {
  const [profileName, setProfileName] = React.useState(existing?.displayName ?? "");
  const [channelName, setChannelName] = React.useState("");
  const [serverUrl, setServerUrl] = React.useState("rtmps://a.rtmps.youtube.com/live2");
  const [streamKey, setStreamKey] = React.useState("");

  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
      <TextField label="Profile Name" onChange={setProfileName} value={profileName} />
      <TextField label="Channel Name" onChange={setChannelName} value={channelName} />
      <TextField label="RTMPS Server URL" onChange={setServerUrl} value={serverUrl} />
      <TextField
        label="Stream Key"
        onChange={setStreamKey}
        placeholder={existing?.hasStreamKey ? "•••••••• (leave blank to keep)" : "Reusable or temporary key"}
        type="password"
        value={streamKey}
      />
      <ReadOnlyField label="Credential Status" value={existing?.hasStreamKey ? "Configured" : "Not set"} />
      <ReadOnlyField label="Last Validation" value={existing?.lastValidatedAt ?? "Never validated"} />
    </div>
  );
}
