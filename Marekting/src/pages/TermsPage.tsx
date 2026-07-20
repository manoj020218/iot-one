import { LegalDocument } from "../components/LegalDocument";
import { PageMeta } from "../components/PageMeta";
import { termsDocument } from "../content/termsDocument";

export function TermsPage() {
  return <>
    <PageMeta title="Terms and Conditions | Smart One by Jenix" description={termsDocument.description} />
    <LegalDocument document={termsDocument} />
  </>;
}
