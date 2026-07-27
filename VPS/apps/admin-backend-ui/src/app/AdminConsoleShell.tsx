import type { PropsWithChildren, ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { useDeveloperSession } from "./DeveloperSessionProvider";

export interface AdminConsoleShellProps extends PropsWithChildren {
  title: string;
  description: string;
  aside?: ReactNode;
}

const navItems = [
  { to: "/admin/developer/pid-management", label: "PID Management" },
  { to: "/admin/developer/package-registry", label: "Package Registry" }
];

export function AdminConsoleShell({
  title,
  description,
  aside,
  children
}: AdminConsoleShellProps) {
  const { session } = useDeveloperSession();

  return (
    <div className="console-shell">
      <nav className="console-rail">
        <div className="console-brand">
          <div className="mark">J1</div>
          <div className="name">
            Jenix One
            <small>ADMIN CONSOLE</small>
          </div>
        </div>
        <div className="console-navgroup">Products</div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? "console-navitem on" : "console-navitem"
            }
          >
            {item.label}
          </NavLink>
        ))}
        <div className="console-foot">
          {session.name} &middot; {session.role}
        </div>
      </nav>

      <div className="console-canvas">
        <div className="console-topbar">
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className="spacer" />
          {aside}
        </div>
        <div className="console-content">{children}</div>
      </div>
    </div>
  );
}
