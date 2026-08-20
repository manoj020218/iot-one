import { React } from "../host";

interface DetailSectionProps {
  title: string;
  note: string;
}

export function DetailSection({ title, note }: DetailSectionProps) {
  return (
    <article className="panel" style={{ marginBottom: 16 }}>
      <div className="scene-section-head">
        <div>
          <span className="eyebrow">{title}</span>
        </div>
      </div>
      <p className="hint-text">{note}</p>
    </article>
  );
}
