import { useContext } from "react";

import { AuthSessionContext } from "../context/AuthContext";

export function useAuth() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthSessionProvider");
  }

  return context;
}
