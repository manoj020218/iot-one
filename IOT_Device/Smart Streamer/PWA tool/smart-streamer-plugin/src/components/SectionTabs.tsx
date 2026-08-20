import { React } from "../host";
import { STREAMER_SECTIONS } from "../navSections";

interface SectionTabsProps {
  active: string;
  onSelect: (id: string) => void;
}

export function SectionTabs({ active, onSelect }: SectionTabsProps) {
  return (
    <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
      {STREAMER_SECTIONS.map((section) => (
        <button
          className={section.id === active ? "primary-button" : "secondary-button"}
          key={section.id}
          onClick={() => onSelect(section.id)}
          type="button"
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}
