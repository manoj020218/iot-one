import { AppShell, StatusPill } from "@jenix/ui";
import type { PropsWithChildren, ReactNode } from "react";
import { Link } from "react-router-dom";

import { useDeveloperSession } from "../../../app/DeveloperSessionProvider";

export interface PidPageShellProps extends PropsWithChildren {
  title: string;
  description: string;
  aside?: ReactNode;
}

export function PidPageShell({
  title,
  description,
  aside,
  children
}: PidPageShellProps) {
  const { session } = useDeveloperSession();

  return (
    <AppShell
      eyebrow="Developer Backend"
      title={title}
      description={description}
      aside={aside ?? <StatusPill label={session.role} tone="warning" />}
    >
      <nav className="admin-nav">
        <Link to="/admin/developer/pid-management">PID Catalog</Link>
        <Link to="/admin/developer/pid-management/new">Create PID</Link>
      </nav>
      {children}
    </AppShell>
  );
}
