import { Navigate, Route, Routes } from "react-router-dom";

import { AuthPage } from "../features/auth/AuthPage";
import { AuthForgotPasswordPage } from "../features/auth/AuthForgotPasswordPage";
import { AuthSignupPage } from "../features/auth/AuthSignupPage";
import { useAuth } from "../features/auth/hooks/useAuth";
import { HomeDashboardPage } from "../features/home/HomeDashboardPage";
import { DeviceDetailPage } from "../features/devices/DeviceDetailPage";
import { NotificationCenterPage } from "../features/notifications/NotificationCenterPage";
import { DeviceManagementPage } from "../features/devices/DeviceManagementPage";
import { ProvisioningHomePage } from "../features/provisioning/ProvisioningHomePage";
import { ApProvisioningPage } from "../features/provisioning/ap/ApProvisioningPage";
import { BleProvisioningPage } from "../features/provisioning/ble/BleProvisioningPage";
import { SceneBuilderPage } from "../features/scenes/SceneBuilderPage";
import { SceneListPage } from "../features/scenes/SceneListPage";
import { StreamerRoute } from "../features/streamer/StreamerRoute";
import { AppUpdatePage } from "../features/settings/AppUpdatePage";
import { HomeDetailPage } from "../features/settings/HomeDetailPage";
import { HomeManagementPage } from "../features/settings/HomeManagementPage";
import { HomeMembersPage } from "../features/settings/HomeMembersPage";
import { SettingsHomePage } from "../features/settings/SettingsHomePage";
import { UserProfilePage } from "../features/settings/UserProfilePage";
import { AuthenticatedAppFrame } from "./layout/AuthenticatedAppFrame";
import { RequireAuth } from "./RequireAuth";

export function AppRouter() {
  const { session } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/login/signup" element={<AuthSignupPage />} />
      <Route path="/login/forgot-password" element={<AuthForgotPasswordPage />} />
      <Route
        element={
          <RequireAuth>
            <AuthenticatedAppFrame />
          </RequireAuth>
        }
      >
        <Route path="/home" element={<HomeDashboardPage />} />
        <Route path="/dashboard" element={<Navigate replace to="/home" />} />
        <Route path="/homes" element={<Navigate replace to="/settings" />} />
        <Route path="/devices" element={<DeviceManagementPage />} />
        <Route path="/devices/:deviceId" element={<DeviceDetailPage />} />
        <Route path="/notifications" element={<NotificationCenterPage />} />
        <Route path="/provisioning" element={<ProvisioningHomePage />} />
        <Route path="/provisioning/ble" element={<BleProvisioningPage />} />
        <Route path="/provisioning/ap" element={<ApProvisioningPage />} />
        <Route path="/scenes" element={<SceneListPage />} />
        <Route path="/scenes/new" element={<SceneBuilderPage />} />
        <Route path="/scenes/:sceneId" element={<SceneBuilderPage />} />
        <Route path="/streamer/*" element={<StreamerRoute />} />
        <Route path="/settings" element={<SettingsHomePage />} />
        <Route path="/settings/profile" element={<UserProfilePage />} />
        <Route path="/settings/homes" element={<HomeManagementPage />} />
        <Route path="/settings/homes/:homeId" element={<HomeDetailPage />} />
        <Route path="/settings/homes/:homeId/members" element={<HomeMembersPage />} />
        <Route path="/settings/app" element={<AppUpdatePage />} />
      </Route>
      <Route
        path="*"
        element={<Navigate replace to={session ? "/home" : "/login"} />}
      />
    </Routes>
  );
}
