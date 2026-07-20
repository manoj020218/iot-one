import { brand } from "../content/brand";

const schema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: brand.presentation,
  alternateName: brand.name,
  url: brand.publicUrl,
  publisher: {
    "@type": "Organization",
    name: brand.businessName,
    brand: brand.presentation,
    email: brand.supportEmail,
    address: {
      "@type": "PostalAddress",
      streetAddress: "63/66A Heera Path, Mansarovar",
      addressLocality: "Jaipur",
      postalCode: "302020",
      addressCountry: "IN"
    }
  }
};

export function StructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
