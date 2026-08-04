export type FeatureIconId =
  | "provisioning"
  | "operations"
  | "automation"
  | "oem"
  | "integrators"
  | "enterprise";

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const
};

const paths: Record<FeatureIconId, JSX.Element> = {
  provisioning: (
    <>
      <path d="M4 17V7a2 2 0 0 1 2-2h8l6 6v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M14 5v6h6" />
    </>
  ),
  operations: (
    <>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </>
  ),
  automation: (
    <>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </>
  ),
  oem: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  integrators: (
    <>
      <path d="M12 2 2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </>
  ),
  enterprise: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 9h1M9 13h1M14 9h1M14 13h1" />
    </>
  )
};

export function FeatureIcon({ id }: { id: FeatureIconId }) {
  return (
    <svg {...iconProps} aria-hidden="true">
      {paths[id]}
    </svg>
  );
}
