import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";

import { useDeveloperSession } from "./DeveloperSessionProvider";

const developerRoles = new Set(["JENIX_DEVELOPER", "JENIX_SUPER_ADMIN"]);

export function RequireDeveloper({ children }: PropsWithChildren) {
  const { session } = useDeveloperSession();

  if (!developerRoles.has(session.role)) {
    return <Navigate replace to="/access-denied" />;
  }

  return <>{children}</>;
}
