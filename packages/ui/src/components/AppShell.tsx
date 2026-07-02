import type { ReactNode } from "react";

export interface AppShellProps {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  eyebrow,
  title,
  description,
  aside,
  children
}: AppShellProps) {
  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "24px 20px 40px"
      }}
    >
      <header
        style={{
          display: "grid",
          gap: 12,
          marginBottom: 24
        }}
      >
        <span
          style={{
            color: "#0f766e",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase"
          }}
        >
          {eyebrow}
        </span>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            flexWrap: "wrap"
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(2rem, 4vw, 3.25rem)",
                lineHeight: 1.05
              }}
            >
              {title}
            </h1>
            <p
              style={{
                margin: 0,
                color: "#475569",
                maxWidth: 640,
                lineHeight: 1.6
              }}
            >
              {description}
            </p>
          </div>
          {aside}
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
