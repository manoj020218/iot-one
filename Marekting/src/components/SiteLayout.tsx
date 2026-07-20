import type { ReactNode } from "react";

import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { StructuredData } from "./StructuredData";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <StructuredData />
      <div className="site-background" aria-hidden="true" />
      <SiteHeader />
      <main className="site-main">{children}</main>
      <SiteFooter />
    </div>
  );
}
