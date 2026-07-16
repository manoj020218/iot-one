import { platformIdentity } from "@jenix/shared";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "./hooks/useAuth";
import { AuthEmailSheet } from "./components/AuthEmailSheet";
import { AuthLayout } from "./components/AuthLayout";
import { AuthQuickAccessCard } from "./components/AuthQuickAccessCard";

export function AuthPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [emailOpen, setEmailOpen] = useState(false);

  async function goHome(action: Promise<void>) {
    await action;
    navigate("/home");
  }

  return (
    <AuthLayout
      eyebrow="Quick Access"
      title={`Welcome to ${platformIdentity.appName}`}
      description="Sign in to your homes, devices, and scenes from one place."
      footer={<span>Secure access for every Jenix member account.</span>}
    >
      <AuthQuickAccessCard
        onEmail={() => setEmailOpen(true)}
        onForgotPassword={() => navigate("/login/forgot-password")}
        onGoogle={() => goHome(auth.loginWithProvider("google"))}
        onSignup={() => navigate("/login/signup")}
      />
      <AuthEmailSheet
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        onSubmit={async (payload) => {
          await goHome(auth.loginWithEmail(payload));
        }}
      />
    </AuthLayout>
  );
}
