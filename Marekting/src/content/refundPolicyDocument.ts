import type { LegalDocument } from "./types";

export const refundPolicyDocument: LegalDocument = {
  title: "Refund and Cancellation Policy",
  description: "This page outlines the refund and cancellation approach for Smart One services where commercial plans or support agreements apply.",
  updatedOn: "17 July 2026",
  sections: [
    {
      title: "Commercial scope",
      paragraphs: [
        "Refunds, cancellations and commercial commitments depend on the service type, agreement model and whether work relates to software access, support, OEM services or integration efforts."
      ]
    },
    {
      title: "Project and service work",
      paragraphs: [
        "OEM, custom integration, engineering, onboarding and deployment work may involve milestones, non-refundable setup effort or partner-specific commercial terms.",
        "Customers should review the applicable quotation, agreement or statement of work for commercial details."
      ]
    },
    {
      title: "How to request review",
      paragraphs: [
        "For any billing, refund or cancellation review, contact Jenix using the official support channel with the relevant service details and agreement reference."
      ]
    }
  ]
};
