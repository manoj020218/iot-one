import { Navigate, Route, Routes } from "react-router-dom";

import { PidCreatePage } from "../features/pid-management/PidCreatePage";
import { PidDetailPage } from "../features/pid-management/PidDetailPage";
import { PidEditPage } from "../features/pid-management/PidEditPage";
import { PidManagementPage } from "../features/pid-management/PidManagementPage";
import { RequireDeveloper } from "./RequireDeveloper";

function AccessDeniedPage() {
  return (
    <section className="access-card">
      <h1>Developer Access Required</h1>
      <p>
        PID management is restricted to `JENIX_DEVELOPER` and
        `JENIX_SUPER_ADMIN` roles.
      </p>
    </section>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/access-denied" element={<AccessDeniedPage />} />
      <Route
        path="/admin/developer/pid-management"
        element={
          <RequireDeveloper>
            <PidManagementPage />
          </RequireDeveloper>
        }
      />
      <Route
        path="/admin/developer/pid-management/new"
        element={
          <RequireDeveloper>
            <PidCreatePage />
          </RequireDeveloper>
        }
      />
      <Route
        path="/admin/developer/pid-management/:pid"
        element={
          <RequireDeveloper>
            <PidDetailPage />
          </RequireDeveloper>
        }
      />
      <Route
        path="/admin/developer/pid-management/:pid/edit"
        element={
          <RequireDeveloper>
            <PidEditPage />
          </RequireDeveloper>
        }
      />
      <Route
        path="*"
        element={<Navigate replace to="/admin/developer/pid-management" />}
      />
    </Routes>
  );
}
