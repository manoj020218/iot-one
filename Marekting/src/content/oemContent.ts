import { primaryActions } from "./brand";
import type { PageContent } from "./types";

export const oemContent: PageContent = {
  title: "OEM Solutions | Smart One by Jenix",
  description: "Launch your own connected product faster with Smart One OEM and white-label IoT capabilities.",
  eyebrow: "OEM and White-Label",
  heroTitle: "Launch your own connected product faster",
  heroBody:
    "Smart One provides an OEM-ready digital foundation for businesses that want to ship connected products under their own brand without rebuilding cloud, application and lifecycle systems from scratch.",
  primaryAction: primaryActions.discussOem,
  secondaryAction: primaryActions.openApp,
  metrics: [
    { value: "Custom branding", label: "App, portal and domain surfaces" },
    { value: "PID allocation", label: "Product identity per customer" },
    { value: "Tenant isolation", label: "Operational separation by agreement" }
  ],
  sections: [
    {
      title: "Brand, product and rollout control",
      body: "Configure app identity, customer-specific product controls, onboarding flows, firmware channels and supported deployment rules according to the chosen OEM model.",
      cards: [
        { title: "White-label surfaces", body: "Branded Android, PWA and web portal experiences." },
        { title: "Product controls", body: "Custom icons, dashboards and feature permissions per product line." }
      ]
    },
    {
      title: "Commercial flexibility with engineering support",
      body: "Jenix can support OEM customers with product integration, firmware coordination and partner-facing rollout planning based on the selected commercial scope.",
      cards: [
        { title: "Technical onboarding", body: "Architecture review, integration guidance and deployment planning." },
        { title: "Commercial caveat", body: "Dedicated infrastructure and source access depend on the agreed OEM arrangement." }
      ]
    }
  ],
  ctaTitle: "Start an OEM discussion with Smart One by Jenix",
  ctaBody: "Share your device type, expected scale and branding goals to begin the right engagement model.",
  ctaPrimary: primaryActions.discussOem
};
