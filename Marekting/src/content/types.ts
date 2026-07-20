export interface LinkAction {
  label: string;
  path: string;
  external?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}

export interface Metric {
  label: string;
  value: string;
}

export interface CardBlock {
  title: string;
  body: string;
  bullets?: string[];
}

export interface PageSection {
  eyebrow?: string;
  title: string;
  body: string;
  cards?: CardBlock[];
}

export interface PageContent {
  title: string;
  description: string;
  eyebrow: string;
  heroTitle: string;
  heroBody: string;
  primaryAction: LinkAction;
  secondaryAction?: LinkAction;
  metrics?: Metric[];
  sections: PageSection[];
  ctaTitle: string;
  ctaBody: string;
  ctaPrimary: LinkAction;
  ctaSecondary?: LinkAction;
}

export interface LegalSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDocument {
  title: string;
  description: string;
  updatedOn: string;
  sections: LegalSection[];
}
