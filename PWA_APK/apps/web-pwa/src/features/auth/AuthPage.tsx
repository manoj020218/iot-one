import { platformIdentity } from "@jenix/shared";
import { useNavigate } from "react-router-dom";

import { useAuth } from "./hooks/useAuth";
import { isNativeShell } from "./nativeShell";
import { AuthLayout } from "./components/AuthLayout";
import { AuthLoginCard } from "./components/AuthLoginCard";
import { requestGoogleAccessToken } from "./services/googleIdentity";
import { requestNativeGoogleIdToken } from "./services/nativeGoogleSignIn";

export function AuthPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  async function goHome(action: Promise<void>) {
    await action;
    navigate("/home");
  }

  async function handleGoogle() {
    if (isNativeShell()) {
      // The web popup flow (below) never renders inside a plain Capacitor
      // WebView -- see nativeGoogleSignIn.ts.
      const idToken = await requestNativeGoogleIdToken();
      await auth.loginWithGoogleIdToken(idToken);
      return;
    }

    const accessToken = await requestGoogleAccessToken();
    await auth.loginWithGoogle(accessToken);
  }

  return (
    <AuthLayout
      title={`Welcome to ${platformIdentity.appName}`}
      description="Sign in to your homes, devices, and scenes from one place."
      footer={<span>Secure access for every Jenix member account.</span>}
    >
      <AuthLoginCard
        onSubmit={(payload) => goHome(auth.loginWithEmail(payload))}
        onGoogle={() => goHome(handleGoogle())}
      />
    </AuthLayout>
  );
}
