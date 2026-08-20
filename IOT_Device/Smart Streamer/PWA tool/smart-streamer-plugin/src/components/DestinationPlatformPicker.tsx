import { React } from "../host";
import { PLATFORM_LABELS, type StreamerPlatform } from "../demoDestinations";

const PLATFORMS: StreamerPlatform[] = ["youtube", "facebook", "instagram"];

export function DestinationPlatformPicker({ onPick }: { onPick: (platform: StreamerPlatform) => void }) {
  return (
    <article className="panel">
      <div className="scene-section-head">
        <div>
          <span className="eyebrow">Add Destination</span>
          <h2 style={{ marginBottom: 4 }}>Choose a Platform</h2>
          <p className="hint-text">Each platform has its own required fields (Streamer Plugin.txt §9).</p>
        </div>
      </div>
      <div className="card-actions" style={{ justifyContent: "flex-start", gap: 10, flexWrap: "wrap" }}>
        {PLATFORMS.map((platform) => (
          <button className="text-button" key={platform} onClick={() => onPick(platform)} type="button">
            {PLATFORM_LABELS[platform]}
          </button>
        ))}
      </div>
    </article>
  );
}
