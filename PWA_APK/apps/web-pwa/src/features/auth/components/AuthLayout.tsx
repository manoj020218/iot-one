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
      <div className="auth-network" aria-hidden="true">
        <span className="node a" />
        <span className="node b" />
        <span className="node c" />
        <span className="node d" />
        <span className="node e" />
        <span className="node f" />
        <span className="line l1" />
        <span className="line l2" />
        <span className="line l3" />
        <span className="line l4" />
      </div>
      <main className="auth-stage">
        <section className="auth-card">
          <div className="auth-brand">J1</div>
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
