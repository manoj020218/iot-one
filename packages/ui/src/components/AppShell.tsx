import type { ReactNode } from "react";

export interface AppShellProps {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
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
        {eyebrow ? (
          <span
            style={{
              color: "#67707c",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase"
            }}
          >
            {eyebrow}
          </span>
        ) : null}
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
                fontSize: "clamp(1.5rem, 4vw, 2.1rem)",
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                color: "#0f1720"
              }}
            >
              {title}
            </h1>
            {description ? (
              <p
                style={{
                  margin: 0,
                  color: "#67707c",
                  maxWidth: 640,
                  lineHeight: 1.6
                }}
              >
                {description}
              </p>
            ) : null}
          </div>
          {aside}
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
