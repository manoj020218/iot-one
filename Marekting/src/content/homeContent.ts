import { primaryActions } from "./brand";
import type { Metric, PageSection } from "./types";

export const homeMetrics: Metric[] = [
  { value: "Web + PWA + Android", label: "Application stack" },
  { value: "MQTT, REST and OTA", label: "Core platform services" },
  { value: "OEM and partner ready", label: "Go-to-market model" }
];

export const homeSections: PageSection[] = [
  {
    eyebrow: "Core Platform",
    title: "Everything required to operate a connected product",
    body:
      "Smart One combines provisioning, telemetry, automation, OTA, alerts, user management and product-specific dashboards in one operating layer.",
    cards: [
      { title: "Provisioning", body: "Support installer-assisted onboarding, local access point setup and Bluetooth-assisted first configuration." },
      { title: "Device Operations", body: "Track live telemetry, alarms, connectivity health and product-specific control surfaces from one dashboard." },
      { title: "Automation", body: "Create scenes based on schedules, sensor values, commands, alerts and cross-device events." }
    ]
  },
  {
    eyebrow: "Device Ecosystem",
    title: "One platform for Jenix products and approved partner hardware",
    body:
      "The platform is designed for Jenix-native products while also allowing approved third-party integrations through documented interfaces and modular plugins.",
    cards: [
      { title: "Jenix Device Experience", body: "Unified identity, provisioning and cloud connection while preserving product-specific controls." },
      { title: "Third-Party Integration", body: "MQTT, HTTPS, webhooks, gateway adapters and custom integration paths for compatible hardware." },
      { title: "Product Plugins", body: "New device categories can load their own dashboards without making the application large or difficult to maintain." }
    ]
  },
  {
    eyebrow: "Who It Serves",
    title: "Built for OEM launches, field operations and long-term product support",
    body:
      "Smart One supports the needs of product builders, system integrators, operations teams and enterprises managing real installed hardware.",
    cards: [
      { title: "OEM Teams", body: "Brandable app surfaces, custom domains, dedicated product identities and customer-specific rollout channels." },
      { title: "System Integrators", body: "Connect existing hardware and operational flows without rebuilding the full cloud and application stack." },
      { title: "Enterprise Operators", body: "Manage roles, sites, alerts, audits, automation and remote lifecycle operations across fleets." }
    ]
  }
];

export const homeCta = {
  title: "Launch or extend your connected product on a platform built for real hardware",
  body:
    "Use Smart One as your digital foundation for device onboarding, cloud communication, app experience, automation and firmware operations.",
  primary: primaryActions.openApp,
  secondary: primaryActions.discussOem
};
