import { React } from "../host";

interface ComingSoonPanelProps {
  note?: string;
}

export function ComingSoonPanel({ note }: ComingSoonPanelProps) {
  return (
    <article className="panel">
      <p className="hint-text">
        This screen is a routing placeholder.{" "}
        {note ?? "Implementation lands in a later phase of the Smart Streamer build-out."}
      </p>
    </article>
  );
}
