import type { PageContent } from "../content/types";
import { CallToActionBand } from "./CallToActionBand";
import { FeatureSection } from "./FeatureSection";
import { HeroSection } from "./HeroSection";
import { PageMeta } from "./PageMeta";

export function ContentPage({ content }: { content: PageContent }) {
  return (
    <>
      <PageMeta title={content.title} description={content.description} />
      <HeroSection
        eyebrow={content.eyebrow}
        title={content.heroTitle}
        body={content.heroBody}
        primaryAction={content.primaryAction}
        secondaryAction={content.secondaryAction}
        metrics={content.metrics}
      />
      {content.sections.map((section) => (
        <FeatureSection key={section.title} section={section} />
      ))}
      <CallToActionBand
        title={content.ctaTitle}
        body={content.ctaBody}
        primary={content.ctaPrimary}
        secondary={content.ctaSecondary}
      />
    </>
  );
}
