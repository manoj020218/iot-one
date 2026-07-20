import { Link } from "react-router-dom";

import type { LinkAction, Metric } from "../content/types";
import { OrbitVisual } from "./OrbitVisual";

interface HeroSectionProps {
  eyebrow: string;
  title: string;
  body: string;
  primaryAction: LinkAction;
  secondaryAction?: LinkAction;
  metrics?: Metric[];
}

function ActionButton({ action }: { action: LinkAction }) {
  const className = `button button-${action.variant ?? "primary"}`;
  if (action.external) {
    return <a className={className} href={action.path}>{action.label}</a>;
  }
  return <Link className={className} to={action.path}>{action.label}</Link>;
}

export function HeroSection(props: HeroSectionProps) {
  return (
    <section className="hero-section">
      <div className="hero-copy">
        <span className="eyebrow">{props.eyebrow}</span>
        <h1>{props.title}</h1>
        <p className="hero-body">{props.body}</p>
        <div className="hero-actions">
          <ActionButton action={props.primaryAction} />
          {props.secondaryAction ? <ActionButton action={props.secondaryAction} /> : null}
        </div>
        {props.metrics ? (
          <div className="metric-strip">
            {props.metrics.map((metric) => (
              <article className="metric-card" key={metric.label}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </article>
            ))}
          </div>
        ) : null}
      </div>
      <OrbitVisual />
    </section>
  );
}
