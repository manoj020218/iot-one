import type { LinkAction } from "./types";

export const brand = {
  name: "Smart One",
  presentation: "Smart One by Jenix",
  descriptor: "OEM IoT Platform",
  appUrl: "https://app.iotsoft.in",
  publicUrl: "https://one.jenix.in",
  supportEmail: "jenixindia@gmail.com",
  whatsapp: "7240226566",
  businessName: "Jain Enterprises",
  address: "63/66A Heera Path, Mansarovar, Jaipur - 302020",
  country: "India"
};

export const navItems: LinkAction[] = [
  { label: "Platform", path: "/platform" },
  { label: "Solutions", path: "/integrations" },
  { label: "OEM", path: "/oem" },
  { label: "Developers", path: "/developers" },
  { label: "Security", path: "/security" },
  { label: "About", path: "/about" },
  { label: "Contact", path: "/contact" }
];

export const footerGroups = [
  {
    title: "Platform",
    links: [
      { label: "Platform", path: "/platform" },
      { label: "OEM", path: "/oem" },
      { label: "Integrations", path: "/integrations" },
      { label: "Developers", path: "/developers" },
      { label: "Security", path: "/security" }
    ]
  },
  {
    title: "Company",
    links: [
      { label: "About", path: "/about" },
      { label: "Contact", path: "/contact" },
      { label: "Support", path: "/support" },
      { label: "Open Smart One", path: brand.appUrl, external: true }
    ]
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", path: "/privacy" },
      { label: "Terms", path: "/terms" },
      { label: "Cookies", path: "/cookies" },
      { label: "Acceptable Use", path: "/acceptable-use" },
      { label: "Data Deletion", path: "/data-deletion" },
      { label: "Refund Policy", path: "/refund-policy" }
    ]
  }
];

export const primaryActions = {
  openApp: {
    label: "Open Smart One",
    path: brand.appUrl,
    external: true,
    variant: "primary"
  } satisfies LinkAction,
  discussOem: {
    label: "Discuss Your OEM IoT Project",
    path: "/contact",
    variant: "secondary"
  } satisfies LinkAction,
  requestApi: {
    label: "Request API Access",
    path: "/contact",
    variant: "primary"
  } satisfies LinkAction,
  requestIntegration: {
    label: "Request Integration Assessment",
    path: "/contact",
    variant: "primary"
  } satisfies LinkAction
};
