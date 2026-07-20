import { LegalDocument } from "../components/LegalDocument";
import { PageMeta } from "../components/PageMeta";
import { acceptableUseDocument } from "../content/acceptableUseDocument";

export function AcceptableUsePage() {
  return <>
    <PageMeta title="Acceptable Use | Smart One by Jenix" description={acceptableUseDocument.description} />
    <LegalDocument document={acceptableUseDocument} />
  </>;
}
