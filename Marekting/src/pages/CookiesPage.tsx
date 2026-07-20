import { LegalDocument } from "../components/LegalDocument";
import { PageMeta } from "../components/PageMeta";
import { cookiesDocument } from "../content/cookiesDocument";

export function CookiesPage() {
  return <>
    <PageMeta title="Cookie Policy | Smart One by Jenix" description={cookiesDocument.description} />
    <LegalDocument document={cookiesDocument} />
  </>;
}
