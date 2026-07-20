import { CallToActionBand } from "../components/CallToActionBand";
import { FeatureSection } from "../components/FeatureSection";
import { HeroSection } from "../components/HeroSection";
import { PageMeta } from "../components/PageMeta";
import { primaryActions } from "../content/brand";
import { homeCta, homeMetrics, homeSections } from "../content/homeContent";

export function HomePage() {
  return (
    <>
      <PageMeta
        title="Smart One by Jenix | OEM IoT Device Management Platform"
        description="Build, connect and manage Jenix and approved third-party IoT products with provisioning, automation, OTA, APIs, PWA, web and Android applications."
      />
      <HeroSection
        eyebrow="Smart One by Jenix"
        title="Build, connect and manage IoT products on one platform"
        body="Smart One is a modular IoT platform for businesses, product manufacturers, system integrators and enterprise operators. Connect Jenix products, integrate approved third-party hardware and manage complete device fleets through one cloud, web and mobile experience."
        primaryAction={primaryActions.openApp}
        secondaryAction={primaryActions.discussOem}
        metrics={homeMetrics}
      />
      {homeSections.map((section) => (
        <FeatureSection key={section.title} section={section} />
      ))}
      <CallToActionBand
        title={homeCta.title}
        body={homeCta.body}
        primary={homeCta.primary}
        secondary={homeCta.secondary}
      />
    </>
  );
}
