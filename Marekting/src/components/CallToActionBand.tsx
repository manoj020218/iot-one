import { Link } from "react-router-dom";

import type { LinkAction } from "../content/types";

function Action({ action }: { action: LinkAction }) {
  const className = `button button-${action.variant ?? "primary"}`;
  if (action.external) {
    return <a className={className} href={action.path}>{action.label}</a>;
  }
  return <Link className={className} to={action.path}>{action.label}</Link>;
}

interface CallToActionBandProps {
  title: string;
  body: string;
  primary: LinkAction;
  secondary?: LinkAction;
}

export function CallToActionBand(props: CallToActionBandProps) {
  return (
    <section className="cta-band">
      <div>
        <span className="eyebrow">Next Step</span>
        <h2>{props.title}</h2>
        <p>{props.body}</p>
      </div>
      <div className="hero-actions">
        <Action action={props.primary} />
        {props.secondary ? <Action action={props.secondary} /> : null}
      </div>
    </section>
  );
}
