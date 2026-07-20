import type { PageSection } from "../content/types";

export function FeatureSection({ section }: { section: PageSection }) {
  return (
    <section className="content-section">
      <div className="section-heading">
        {section.eyebrow ? <span className="eyebrow">{section.eyebrow}</span> : null}
        <h2>{section.title}</h2>
        <p>{section.body}</p>
      </div>
      {section.cards ? (
        <div className="card-grid">
          {section.cards.map((card) => (
            <article className="feature-card" key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              {card.bullets ? (
                <ul>
                  {card.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
