import { primaryActions } from "./brand";
import type { PageContent } from "./types";

export const integrationsContent: PageContent = {
  title: "Integrations | Smart One by Jenix",
  description: "Bring approved third-party hardware into Smart One through MQTT, REST, webhooks and gateway integrations.",
  eyebrow: "Approved Integrations",
  heroTitle: "Bring existing hardware into Smart One",
  heroBody:
    "Smart One supports approved third-party device integration so manufacturers and integrators can extend hardware value without rebuilding the full application and cloud layer.",
  primaryAction: primaryActions.requestIntegration,
  secondaryAction: primaryActions.discussOem,
  metrics: [
    { value: "MQTT", label: "Device and gateway flows" },
    { value: "REST", label: "Cloud and partner APIs" },
    { value: "Gateway adapters", label: "Field protocol bridging" }
  ],
  sections: [
    {
      title: "Supported through approved integration paths",
      body: "Integration support is based on documented and validated interfaces rather than assuming every third-party device will work automatically.",
      cards: [
        { title: "Direct integration", body: "MQTT devices, HTTPS clients and cloud-to-cloud partners." },
        { title: "Gateway integration", body: "Modbus, RS485 and vendor-specific adapters through edge or field gateways." }
      ]
    },
    {
      title: "Integration assessment before deployment",
      body: "Jenix reviews protocol fit, security needs, telemetry design and operational controls before onboarding partner hardware into Smart One.",
      cards: [
        { title: "Security review", body: "Credential handling, topic boundaries and command safety." },
        { title: "UI mapping", body: "Product-specific controls and dashboards through modular plugins." }
      ]
    }
  ],
  ctaTitle: "Request an integration assessment",
  ctaBody: "Share protocol details, device type and expected operating model so the right integration path can be defined.",
  ctaPrimary: primaryActions.requestIntegration
};
