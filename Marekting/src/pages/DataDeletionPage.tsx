import { LegalDocument } from "../components/LegalDocument";
import { PageMeta } from "../components/PageMeta";
import { dataDeletionDocument } from "../content/dataDeletionDocument";

export function DataDeletionPage() {
  return <>
    <PageMeta title="Data Deletion | Smart One by Jenix" description={dataDeletionDocument.description} />
    <LegalDocument document={dataDeletionDocument} />
  </>;
}
