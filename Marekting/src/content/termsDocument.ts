import type { LegalDocument } from "./types";

export const termsDocument: LegalDocument = {
  title: "Terms and Conditions",
  description: "These terms govern the use of Smart One by Jenix, connected devices, partner integrations and associated services.",
  updatedOn: "17 July 2026",
  sections: [
    {
      title: "Platform use and eligibility",
      paragraphs: [
        "By using Smart One, you confirm that you have authority to use the service for yourself, your organization or the devices you administer.",
        "Access to some functions may depend on supported hardware, connectivity, approved integrations and operational status."
      ]
    },
    {
      title: "Accounts, devices and responsibilities",
      paragraphs: [
        "You are responsible for account security, installer actions performed through your access, device assignment accuracy and safe use of remote control functions.",
        "You must not use Smart One to interfere with devices, networks, tenants, services or partner systems without authorization."
      ],
      bullets: [
        "protect login credentials and access tokens",
        "maintain safe installation and field procedures",
        "keep device ownership and site assignments accurate",
        "comply with applicable law and local safety requirements"
      ]
    },
    {
      title: "Third-party devices and connectivity",
      paragraphs: [
        "Third-party hardware is supported only through approved integration methods. Compatibility, behaviour and support scope may vary by device category and integration agreement.",
        "Cloud functions depend on connectivity, infrastructure availability and supported device behaviour."
      ]
    },
    {
      title: "Safety and operational limits",
      paragraphs: [
        "Smart One must not be treated as the only safeguard for life-safety, emergency response or critical industrial risk control. Users must maintain suitable physical procedures, manual controls and site-specific safety practices.",
        "Remote sirens, alerts, access systems, pumps, flood systems or industrial controls must be deployed with appropriate local safety design."
      ]
    },
    {
      title: "Liability, suspension and changes",
      paragraphs: [
        "We may suspend access where needed for security, misuse, maintenance, legal compliance or service protection.",
        "These terms may change as Smart One evolves. Continued use after updated terms are published indicates acceptance of the revised terms."
      ]
    }
  ]
};
