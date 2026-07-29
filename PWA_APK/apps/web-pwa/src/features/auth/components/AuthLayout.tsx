import type { PropsWithChildren, ReactNode } from "react";

export interface AuthLayoutProps extends PropsWithChildren {
  eyebrow: string;
  title: string;
  description: string;
  footer?: ReactNode;
}

export function AuthLayout({
  eyebrow,
  title,
  description,
  footer,
  children
}: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <main className="auth-stage">
        <section className="auth-card">
          <div className="auth-brand" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="26"
              height="26"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
            </svg>
          </div>
          <span className="auth-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
          {children}
          {footer ? <footer className="auth-footer">{footer}</footer> : null}
        </section>
      </main>
    </div>
  );
}
