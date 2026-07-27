import type { PropsWithChildren, ReactNode } from "react";
import { Link } from "react-router-dom";

import { AdminConsoleShell } from "../../../app/AdminConsoleShell";

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
  return (
    <AdminConsoleShell title={title} description={description} aside={aside}>
      <nav className="admin-nav">
        <Link to="/admin/developer/pid-management">PID Catalog</Link>
        <Link to="/admin/developer/pid-management/new">Create PID</Link>
      </nav>
      {children}
    </AdminConsoleShell>
  );
}
