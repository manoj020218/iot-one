import { useEffect } from "react";

import { brand } from "../content/brand";

interface RedirectCardProps {
  title: string;
  body: string;
}

export function RedirectCard({ title, body }: RedirectCardProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.href = brand.appUrl;
    }, 1600);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className="redirect-card">
      <span className="eyebrow">Application Access</span>
      <h1>{title}</h1>
      <p>{body}</p>
      <a className="button button-primary" href={brand.appUrl}>
        Open Smart One
      </a>
    </section>
  );
}
