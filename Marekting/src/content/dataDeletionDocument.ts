import { brand } from "./brand";
import type { LegalDocument } from "./types";

export const dataDeletionDocument: LegalDocument = {
  title: "Account and Data Deletion",
  description: "This page explains how Smart One users can request deletion of accounts and related data, even if they cannot access the app.",
  updatedOn: "17 July 2026",
  sections: [
    {
      title: "Ways to request deletion",
      paragraphs: [
        "Users should be able to request deletion from inside the application and also through a public support route when app access is unavailable.",
        `If you cannot access your account, contact ${brand.supportEmail} with your registered email address and deletion request details.`
      ]
    },
    {
      title: "What deletion may affect",
      paragraphs: [
        "Deleting an account can remove access to homes, sites, devices, automation and support history associated with that identity.",
        "Users should review device ownership transfer needs before confirming deletion."
      ]
    },
    {
      title: "What may be retained",
      paragraphs: [
        "Certain records may be retained for security, audit, anti-fraud, financial, legal or dispute-handling requirements even after the main account is deleted."
      ]
    }
  ]
};
