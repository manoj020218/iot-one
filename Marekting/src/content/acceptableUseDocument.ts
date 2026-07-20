import type { LegalDocument } from "./types";

export const acceptableUseDocument: LegalDocument = {
  title: "Acceptable Use Policy",
  description: "This policy explains prohibited conduct when using Smart One by Jenix, its public site, APIs and connected services.",
  updatedOn: "17 July 2026",
  sections: [
    {
      title: "Permitted use",
      paragraphs: [
        "Smart One may be used only for authorized account activity, approved device operations, partner integrations and lawful business or operational purposes."
      ]
    },
    {
      title: "Prohibited conduct",
      paragraphs: [
        "You must not attempt to misuse the service, bypass security, interfere with other users or publish harmful, unlawful or deceptive material through the platform."
      ],
      bullets: [
        "unauthorized access attempts",
        "credential sharing for misuse",
        "topic or API abuse",
        "malicious automation or command flooding",
        "reverse engineering for unauthorized exploitation"
      ]
    },
    {
      title: "Enforcement",
      paragraphs: [
        "We may suspend accounts, revoke credentials, block traffic or investigate activity where misuse, risk or legal concerns arise."
      ]
    }
  ]
};
