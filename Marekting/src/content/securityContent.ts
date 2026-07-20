import { primaryActions } from "./brand";
import type { PageContent } from "./types";

export const securityContent: PageContent = {
  title: "Security | Smart One by Jenix",
  description: "Read the Smart One security approach across devices, users, sessions, permissions and cloud operations.",
  eyebrow: "Security Approach",
  heroTitle: "Security across devices, users and cloud services",
  heroBody:
    "Smart One is designed to secure device identity, user access, cloud sessions and operational boundaries while supporting field hardware and partner integrations.",
  primaryAction: primaryActions.requestIntegration,
  secondaryAction: primaryActions.openApp,
  metrics: [
    { value: "Role control", label: "RBAC and tenant boundaries" },
    { value: "Token sessions", label: "Managed web and mobile access" },
    { value: "Operational audit", label: "Traceable admin actions" }
  ],
  sections: [
    {
      title: "Practical security controls",
      body: "Security messaging on this site is limited to controls that can be implemented, operated and reviewed in real deployments.",
      cards: [
        { title: "Identity and sessions", body: "Secure password handling, token-based sessions and controlled account access." },
        { title: "Device boundaries", body: "Per-device credentials, ownership transfer rules and controlled communication paths." }
      ]
    },
    {
      title: "Governance and recovery",
      body: "Operational security also includes permissions, audit records, backup expectations and incident response procedures rather than only cryptography claims.",
      cards: [
        { title: "Audit and admin controls", body: "Record important configuration and administrative actions." },
        { title: "Recovery posture", body: "Support backup, restoration and service recovery planning." }
      ]
    }
  ],
  ctaTitle: "Discuss security expectations before deployment",
  ctaBody: "Share the device category, field risk and integration model so the right controls can be planned early.",
  ctaPrimary: primaryActions.discussOem
};
