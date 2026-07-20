import { LegalDocument } from "../components/LegalDocument";
import { PageMeta } from "../components/PageMeta";
import { privacyDocument } from "../content/privacyDocument";

export function PrivacyPage() {
  return <>
    <PageMeta title="Privacy Policy | Smart One by Jenix" description={privacyDocument.description} />
    <LegalDocument document={privacyDocument} />
  </>;
}
