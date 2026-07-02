import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../features/auth/hooks/useAuth";

export function RequireAuth({ children }: PropsWithChildren) {
  const { session } = useAuth();

  if (!session) {
    return <Navigate replace to="/login" />;
  }

  return <>{children}</>;
}
