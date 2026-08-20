import { React } from "../host";
import { DEMO_STREAMER_DESTINATIONS, PLATFORM_LABELS, type StreamerPlatform } from "../demoDestinations";
import { DestinationPlatformPicker } from "../components/DestinationPlatformPicker";
import { YouTubeDestinationForm } from "../destinationForms/YouTubeDestinationForm";
import { FacebookDestinationForm } from "../destinationForms/FacebookDestinationForm";
import { InstagramDestinationForm } from "../destinationForms/InstagramDestinationForm";

interface DestinationFormPageProps {
  destinationId: string | null;
  onBack: () => void;
}

const PLATFORM_FORMS: Record<StreamerPlatform, React.ComponentType<{ existing: ReturnType<typeof findExisting> }>> = {
  youtube: YouTubeDestinationForm,
  facebook: FacebookDestinationForm,
  instagram: InstagramDestinationForm
};

function findExisting(destinationId: string | null) {
  return destinationId
    ? DEMO_STREAMER_DESTINATIONS.find((destination) => destination.destinationId === destinationId)
    : undefined;
}

export function DestinationFormPage({ destinationId, onBack }: DestinationFormPageProps) {
  const existing = findExisting(destinationId);
  const [chosenPlatform, setChosenPlatform] = React.useState<StreamerPlatform | null>(existing?.platform ?? null);

  return (
    <section>
      <button className="text-button" onClick={onBack} style={{ marginBottom: 12 }} type="button">
        ← Back to Destinations
      </button>

      {!chosenPlatform ? (
        <DestinationPlatformPicker onPick={setChosenPlatform} />
      ) : (
        <article className="panel">
          <div className="scene-section-head">
            <div>
              <span className="eyebrow">{existing ? "Edit Destination" : "Add Destination"}</span>
              <h2 style={{ marginBottom: 4 }}>{PLATFORM_LABELS[chosenPlatform]}</h2>
            </div>
          </div>
          {React.createElement(PLATFORM_FORMS[chosenPlatform], { existing })}
          <p className="hint-text" style={{ marginTop: 12 }}>
            Stream keys and OAuth references are write-only — never returned by the server
            after saving (VPS/API_CONTRACT.md §3).
          </p>
          <div className="card-actions" style={{ marginTop: 12 }}>
            <button className="text-button" disabled type="button">
              Validate Destination
            </button>
            <button className="text-button" disabled type="button">
              {existing ? "Save Changes" : "Create Destination"}
            </button>
          </div>
        </article>
      )}
    </section>
  );
}
