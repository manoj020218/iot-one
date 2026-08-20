import { React } from "./host";
import type { RemoteProductPackageProps } from "./types";
import { SectionTabs } from "./components/SectionTabs";
import { STREAMER_SECTIONS } from "./navSections";
import { StreamerSectionContent } from "./StreamerSectionContent";

// Root export the host resolves and mounts at /streamer/*. Navigation
// between sections is internal component state, not URL routing — this
// plugin bundles no router of its own (see README.md for why). Each
// section's own drill-down state (selected device, camera being edited,
// ...) lives inside StreamerSectionContent, remounted fresh per section
// via the key prop below.
export function SmartStreamerApp(_props: RemoteProductPackageProps) {
  const [active, setActive] = React.useState("overview");
  const activeLabel = STREAMER_SECTIONS.find((section) => section.id === active)?.label ?? "Overview";

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 40px" }}>
      <header style={{ marginBottom: 20 }}>
        <span
          style={{
            color: "#67707c",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase"
          }}
        >
          Smart Streamer
        </span>
        <h1 style={{ margin: "4px 0 0", fontSize: "clamp(1.5rem, 4vw, 2.1rem)" }}>{activeLabel}</h1>
      </header>
      <SectionTabs active={active} onSelect={setActive} />
      <StreamerSectionContent key={active} onNavigate={setActive} section={active} />
    </div>
  );
}
