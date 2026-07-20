import { primaryActions } from "./brand";
import type { PageContent } from "./types";

export const aboutContent: PageContent = {
  title: "About | Smart One by Jenix",
  description: "Learn about Jenix engineering capability across embedded systems, firmware, cloud software and field deployment.",
  eyebrow: "About Jenix",
  heroTitle: "Engineering connected products for real-world operations",
  heroBody:
    "Smart One by Jenix brings together electronics, firmware, cloud software, mobile applications and field deployment understanding to support connected products in practical environments.",
  primaryAction: primaryActions.discussOem,
  secondaryAction: primaryActions.openApp,
  metrics: [
    { value: "Embedded + cloud", label: "Designed together" },
    { value: "Field-aware", label: "Installer and operator focused" },
    { value: "OEM ready", label: "Built for product partnerships" }
  ],
  sections: [
    {
      title: "What Jenix builds",
      body: "Jenix develops connected systems across safety, access, monitoring, automation and infrastructure use cases while using Smart One as the common digital platform.",
      cards: [
        { title: "Engineering stack", body: "Electronics, embedded firmware, cloud software, Android, PWA and system integration." },
        { title: "Operational mindset", body: "Real deployment concerns like provisioning, maintenance, alerts and support are part of the design process." }
      ]
    },
    {
      title: "Business identity",
      body: "The public platform identity is Smart One by Jenix. The business operator details used across website, support and policy pages must remain consistent.",
      cards: [
        { title: "Operator", body: "Jain Enterprises, Jaipur, India." },
        { title: "Support channel", body: "jenixindia@gmail.com and business WhatsApp +91 7240226566." }
      ]
    }
  ],
  ctaTitle: "Talk to the team behind Smart One",
  ctaBody: "Start with a product, OEM or integration conversation and Jenix can guide the next technical step.",
  ctaPrimary: primaryActions.discussOem
};
