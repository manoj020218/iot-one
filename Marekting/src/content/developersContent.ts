import { primaryActions } from "./brand";
import type { PageContent } from "./types";

export const developersContent: PageContent = {
  title: "Developers | Smart One by Jenix",
  description: "Approved partners can integrate with Smart One using REST APIs, MQTT, webhooks and versioned access models.",
  eyebrow: "Developers and APIs",
  heroTitle: "Integrate Smart One products into your application stack",
  heroBody:
    "Approved partners can use Smart One interfaces for status, telemetry, events and authorized control functions while keeping device ownership and user permissions under one platform.",
  primaryAction: primaryActions.requestApi,
  secondaryAction: primaryActions.requestIntegration,
  metrics: [
    { value: "REST API", label: "Status, control and account flows" },
    { value: "MQTT", label: "Realtime device messaging" },
    { value: "Webhooks", label: "Outbound event delivery" }
  ],
  sections: [
    {
      title: "Partner-grade integration surfaces",
      body: "Smart One can expose documented interfaces for approved partners without leaking production secrets or internal infrastructure details.",
      cards: [
        { title: "Versioned APIs", body: "Stable partner contracts with validation and access rules." },
        { title: "Auth and rate controls", body: "Secure tokens, scoped access and operational guardrails." }
      ]
    },
    {
      title: "Designed for integration without full platform duplication",
      body: "Partner systems can consume telemetry and authorized controls while Smart One remains the central platform for provisioning, ownership, alerts and lifecycle operations.",
      cards: [
        { title: "Operational clarity", body: "Use APIs for business logic, not for bypassing platform governance." },
        { title: "Extension path", body: "Use modular page plugins when a device requires its own application experience." }
      ]
    }
  ],
  ctaTitle: "Request developer access",
  ctaBody: "Tell Jenix about your application, expected traffic and integration objective to begin the right API discussion.",
  ctaPrimary: primaryActions.requestApi
};
