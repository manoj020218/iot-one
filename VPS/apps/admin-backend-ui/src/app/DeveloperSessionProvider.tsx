import { createContext, useContext, useState, type PropsWithChildren } from "react";

export type DeveloperRole =
  | "JENIX_DEVELOPER"
  | "JENIX_SUPER_ADMIN"
  | "VIEWER";

export interface DeveloperSession {
  actorId: string;
  name: string;
  role: DeveloperRole;
}

export interface DeveloperSessionContextValue {
  session: DeveloperSession;
  setRole: (role: DeveloperRole) => void;
}

const defaultSession: DeveloperSession = {
  actorId: "admin-ui",
  name: "Developer Console",
  role: "JENIX_DEVELOPER"
};

const DeveloperSessionContext =
  createContext<DeveloperSessionContextValue | null>(null);

export interface DeveloperSessionProviderProps extends PropsWithChildren {
  initialSession?: DeveloperSession;
}

export function DeveloperSessionProvider({
  children,
  initialSession = defaultSession
}: DeveloperSessionProviderProps) {
  const [session, setSession] = useState<DeveloperSession>(initialSession);

  return (
    <DeveloperSessionContext.Provider
      value={{
        session,
        setRole(role) {
          setSession((current) => ({
            ...current,
            role
          }));
        }
      }}
    >
      {children}
    </DeveloperSessionContext.Provider>
  );
}

export function useDeveloperSession() {
  const context = useContext(DeveloperSessionContext);

  if (!context) {
    throw new Error(
      "useDeveloperSession must be used within DeveloperSessionProvider"
    );
  }

  return context;
}
