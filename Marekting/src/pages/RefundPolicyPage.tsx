import { LegalDocument } from "../components/LegalDocument";
import { PageMeta } from "../components/PageMeta";
import { refundPolicyDocument } from "../content/refundPolicyDocument";

export function RefundPolicyPage() {
  return <>
    <PageMeta title="Refund Policy | Smart One by Jenix" description={refundPolicyDocument.description} />
    <LegalDocument document={refundPolicyDocument} />
  </>;
}
