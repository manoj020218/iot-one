import { primaryActions } from "./brand";
import type { PageContent } from "./types";

export const signupContent: PageContent = {
  title: "Signup | Smart One by Jenix",
  description: "Start your Smart One journey through application access, OEM discussion or partner onboarding.",
  eyebrow: "Start With Smart One",
  heroTitle: "Choose the right onboarding path for your role",
  heroBody:
    "Existing customers can open Smart One directly, while OEM prospects, API partners and device integrators can begin through a guided business and technical discussion.",
  primaryAction: primaryActions.openApp,
  secondaryAction: primaryActions.discussOem,
  sections: [
    {
      title: "For product operators and existing customers",
      body: "Use Smart One directly if your organization already has access to the application environment.",
      cards: [
        { title: "Open the app", body: "Continue to the Smart One application for account sign in." }
      ]
    },
    {
      title: "For OEM and integration partners",
      body: "If you need a new project, white-label setup or device integration path, begin with a structured enquiry instead of a generic public sign-up form.",
      cards: [
        { title: "OEM discussions", body: "Branding, device categories, rollout model and commercial scope." },
        { title: "Integration requests", body: "Protocol fit, API needs and approved partner onboarding." }
      ]
    }
  ],
  ctaTitle: "Open Smart One or start a product discussion",
  ctaBody: "Use the application if access already exists. Otherwise contact Jenix for the right onboarding path.",
  ctaPrimary: primaryActions.openApp,
  ctaSecondary: primaryActions.discussOem
};
