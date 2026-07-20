import { primaryActions } from "./brand";
import type { PageContent } from "./types";

export const supportContent: PageContent = {
  title: "Support | Smart One by Jenix",
  description: "Find Smart One support channels for platform access, device help, integration questions and privacy requests.",
  eyebrow: "Customer Support",
  heroTitle: "Support for platform, device and integration needs",
  heroBody:
    "Use the support route for account questions, deployment assistance, integration guidance and privacy requests related to Smart One by Jenix.",
  primaryAction: primaryActions.openApp,
  secondaryAction: primaryActions.discussOem,
  metrics: [
    { value: "Account help", label: "Login, access and ownership issues" },
    { value: "Device help", label: "Provisioning and operational questions" },
    { value: "Integration help", label: "API and protocol support" }
  ],
  sections: [
    {
      title: "Support channels by purpose",
      body: "Keep operational issues, integration requests and privacy matters clearly separated so they can be handled by the right team path.",
      cards: [
        { title: "Platform support", body: "Account access, app guidance and day-to-day usage support." },
        { title: "Technical integration", body: "Protocol, API, gateway and partner hardware questions." },
        { title: "Privacy and deletion", body: "Data access, correction and deletion requests." }
      ]
    }
  ],
  ctaTitle: "Need direct help from Jenix?",
  ctaBody: "Open the app if you already use Smart One, or contact the team for account, OEM or integration support.",
  ctaPrimary: primaryActions.openApp,
  ctaSecondary: primaryActions.discussOem
};
