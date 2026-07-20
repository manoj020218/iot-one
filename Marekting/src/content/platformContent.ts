import { primaryActions } from "./brand";
import type { PageContent } from "./types";

export const platformContent: PageContent = {
  title: "Platform | Smart One by Jenix",
  description: "Explore Smart One platform capabilities for provisioning, dashboards, automation, alerts, OTA and access control.",
  eyebrow: "Platform Capabilities",
  heroTitle: "Operate connected products with one modular control layer",
  heroBody:
    "Smart One gives product teams a unified operational platform for onboarding, telemetry, alerts, automation, firmware rollout and user permissions across web and mobile applications.",
  primaryAction: primaryActions.openApp,
  secondaryAction: primaryActions.discussOem,
  metrics: [
    { value: "Provisioning", label: "AP, BLE and installer assisted" },
    { value: "Telemetry", label: "Live status and operational insight" },
    { value: "OTA", label: "Controlled firmware rollout" }
  ],
  sections: [
    {
      title: "Device onboarding and operational dashboards",
      body: "Provision supported devices, track connectivity, expose product-specific controls and organize installed fleets by home, site, building or project structure.",
      cards: [
        { title: "Installer flows", body: "Use field-friendly setup patterns that reduce time to first connection." },
        { title: "Dashboards", body: "Expose status, alarms, telemetry and actions in product-specific interfaces." }
      ]
    },
    {
      title: "Automation, alerts and OTA lifecycle management",
      body: "Use Smart One for scheduled actions, sensor-driven automations, remote alerts and firmware release orchestration by PID, device group or rollout policy.",
      cards: [
        { title: "Scenes", body: "Combine device state, schedules and conditions into repeatable actions." },
        { title: "OTA controls", body: "Release firmware safely with staged targeting and operational oversight." }
      ]
    }
  ],
  ctaTitle: "See how Smart One fits your product operations",
  ctaBody: "Discuss your device category, deployment model and support requirements with Jenix.",
  ctaPrimary: primaryActions.discussOem,
  ctaSecondary: primaryActions.openApp
};
