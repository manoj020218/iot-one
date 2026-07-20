import { brand } from "./brand";
import type { LegalDocument } from "./types";

export const privacyDocument: LegalDocument = {
  title: "Privacy Policy",
  description: "This policy explains how Smart One by Jenix collects, uses, stores and protects account, device and operational information.",
  updatedOn: "17 July 2026",
  sections: [
    {
      title: "Who operates Smart One",
      paragraphs: [
        `Smart One is an IoT platform operated by ${brand.businessName}, presented publicly as Smart One by Jenix.`,
        `Support, privacy and account requests can be sent to ${brand.supportEmail}.`
      ]
    },
    {
      title: "Information we collect",
      paragraphs: [
        "Smart One may collect account information, authentication details, user roles, device identifiers, product identity records, ownership mappings, homes or sites created by users, operational telemetry, alerts, automation records, diagnostic data and support communications.",
        "During provisioning, Smart One features may use local network, Bluetooth, Wi-Fi setup information, camera input for QR scanning and location-related signals where needed for visible product functions."
      ],
      bullets: [
        "name, email address and account profile",
        "sign-in provider information when Google login is used",
        "device IDs, product IDs and firmware metadata",
        "home, site, room or operational structure created by users",
        "telemetry, commands, alerts and audit records"
      ]
    },
    {
      title: "How information is used",
      paragraphs: [
        "We use information to create and secure accounts, link users to devices, deliver dashboards, process commands, run automations, provide support, maintain service integrity and improve operational visibility.",
        "We do not state that data is unused when it is required for authentication, provisioning, device control, alerting, diagnostics or service protection."
      ]
    },
    {
      title: "Sharing and retention",
      paragraphs: [
        "Information may be shared with infrastructure providers, notification providers, support channels or approved service partners only where required to operate Smart One, meet legal obligations or support authorized customer workflows.",
        "Information is retained according to operational need, contractual responsibility, fraud prevention, dispute handling, security review and applicable law."
      ]
    },
    {
      title: "User rights and deletion",
      paragraphs: [
        "Users can request access, correction or deletion of account-related information. Deletion requests may require identity verification and may affect device ownership, site access and automation continuity.",
        "Some records may be retained where required for security, audit, fraud prevention, financial or legal obligations."
      ]
    }
  ]
};
