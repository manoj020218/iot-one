import { ContactForm } from "../components/ContactForm";
import { FeatureSection } from "../components/FeatureSection";
import { HeroSection } from "../components/HeroSection";
import { PageMeta } from "../components/PageMeta";
import { primaryActions } from "../content/brand";

const contactSection = {
  eyebrow: "Enquiries",
  title: "Sales, integration and support requests",
  body: "Use the contact path for OEM projects, API and integration requests, platform assistance and privacy-related enquiries.",
  cards: [
    { title: "Sales and OEM", body: "White-label launches, branded applications, new connected product lines and deployment planning." },
    { title: "Technical integration", body: "MQTT, REST, gateway, firmware and partner-device coordination." },
    { title: "Support and privacy", body: "Account help, application issues, operational questions and data requests." }
  ]
};

export function ContactPage() {
  return (
    <>
      <PageMeta
        title="Contact | Smart One by Jenix"
        description="Contact Smart One by Jenix for OEM, integration, developer and platform support enquiries."
      />
      <HeroSection
        eyebrow="Contact Jenix"
        title="Start a serious IoT conversation with the right team"
        body="Whether you are planning an OEM launch, integrating approved hardware or need platform guidance, Smart One by Jenix provides a clear path to the correct business and technical discussion."
        primaryAction={primaryActions.discussOem}
        secondaryAction={primaryActions.requestApi}
      />
      <FeatureSection section={contactSection} />
      <section className="content-section">
        <div className="section-heading">
          <span className="eyebrow">Contact Form</span>
          <h2>Prepare a structured enquiry</h2>
          <p>Use a complete project summary so the response can move directly into the right sales or technical track.</p>
        </div>
        <ContactForm />
      </section>
    </>
  );
}
