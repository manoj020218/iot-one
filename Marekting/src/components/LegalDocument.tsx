import type { LegalDocument as LegalDocumentType } from "../content/types";

export function LegalDocument({ document }: { document: LegalDocumentType }) {
  return (
    <article className="legal-document">
      <header className="legal-header">
        <span className="eyebrow">Legal</span>
        <h1>{document.title}</h1>
        <p>{document.description}</p>
        <small>Last updated: {document.updatedOn}</small>
      </header>
      {document.sections.map((section) => (
        <section className="legal-section" key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.bullets ? (
            <ul>
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </article>
  );
}
