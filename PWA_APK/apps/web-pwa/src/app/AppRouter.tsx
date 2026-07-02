import { Navigate, Route, Routes } from "react-router-dom";

import { AuthPage } from "../features/auth/AuthPage";
import { useAuth } from "../features/auth/hooks/useAuth";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { DeviceDetailPage } from "../features/devices/DeviceDetailPage";
import { DeviceManagementPage } from "../features/devices/DeviceManagementPage";
import { HomeManagementPage } from "../features/homes/HomeManagementPage";
import { ProvisioningHomePage } from "../features/provisioning/ProvisioningHomePage";
import { ApProvisioningPage } from "../features/provisioning/ap/ApProvisioningPage";
import { BleProvisioningPage } from "../features/provisioning/ble/BleProvisioningPage";
import { SceneBuilderPage } from "../features/scenes/SceneBuilderPage";
import { SceneListPage } from "../features/scenes/SceneListPage";
import { AppUpdatePage } from "../features/settings/AppUpdatePage";
import { SettingsHomePage } from "../features/settings/SettingsHomePage";
import { UserProfilePage } from "../features/settings/UserProfilePage";
import { RequireAuth } from "./RequireAuth";

export function AppRouter() {
  const { session } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/homes"
        element={
          <RequireAuth>
            <HomeManagementPage />
          </RequireAuth>
        }
      />
      <Route
        path="/devices"
        element={
          <RequireAuth>
            <DeviceManagementPage />
          </RequireAuth>
        }
      />
      <Route
        path="/devices/:deviceId"
        element={
          <RequireAuth>
            <DeviceDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/provisioning"
        element={
          <RequireAuth>
            <ProvisioningHomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/provisioning/ble"
        element={
          <RequireAuth>
            <BleProvisioningPage />
          </RequireAuth>
        }
      />
      <Route
        path="/provisioning/ap"
        element={
          <RequireAuth>
            <ApProvisioningPage />
          </RequireAuth>
        }
      />
      <Route
        path="/scenes"
        element={
          <RequireAuth>
            <SceneListPage />
          </RequireAuth>
        }
      />
      <Route
        path="/scenes/new"
        element={
          <RequireAuth>
            <SceneBuilderPage />
          </RequireAuth>
        }
      />
      <Route
        path="/scenes/:sceneId"
        element={
          <RequireAuth>
            <SceneBuilderPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsHomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings/profile"
        element={
          <RequireAuth>
            <UserProfilePage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings/app"
        element={
          <RequireAuth>
            <AppUpdatePage />
          </RequireAuth>
        }
      />
      <Route
        path="*"
        element={<Navigate replace to={session ? "/dashboard" : "/login"} />}
      />
    </Routes>
  );
}
