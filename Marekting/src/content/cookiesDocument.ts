import type { LegalDocument } from "./types";

export const cookiesDocument: LegalDocument = {
  title: "Cookie Policy",
  description: "This policy explains how Smart One by Jenix uses cookies and similar technologies on its public website and applications.",
  updatedOn: "17 July 2026",
  sections: [
    {
      title: "Why cookies are used",
      paragraphs: [
        "Cookies and similar technologies may be used for session continuity, security controls, user preferences, performance measurement and consent management where applicable.",
        "Operational cookies can be necessary for authentication and safe platform access."
      ]
    },
    {
      title: "Types of cookies",
      paragraphs: [
        "Smart One may use essential cookies, preference cookies and limited analytics technologies where enabled in line with the published privacy and consent approach."
      ],
      bullets: [
        "essential sign-in and session cookies",
        "preference cookies for saved choices",
        "analytics cookies only where enabled appropriately"
      ]
    },
    {
      title: "Managing cookie choices",
      paragraphs: [
        "Users can manage browser cookie settings and, where applicable, consent choices presented by the website.",
        "Blocking some cookies may affect application sign-in, saved choices or other visible functions."
      ]
    }
  ]
};
