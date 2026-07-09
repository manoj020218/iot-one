import { platformIdentity } from "@jenix/shared";
import { AppShell, StatusPill } from "@jenix/ui";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "./hooks/useAuth";
import { EmailLoginForm } from "./components/EmailLoginForm";
import { FacebookLoginButton } from "./components/FacebookLoginButton";
import { GoogleLoginButton } from "./components/GoogleLoginButton";
import { SignupForm } from "./components/SignupForm";

export function AuthPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<string | null>(null);

  async function handleProviderLogin(provider: "google" | "facebook") {
    await auth.loginWithProvider(provider);
    navigate("/home");
  }

  async function handleEmailLogin(payload: { email: string; password: string }) {
    await auth.loginWithEmail(payload);
    navigate("/home");
  }

  async function handleSignup(payload: {
    name: string;
    email: string;
    password: string;
  }) {
    await auth.signupWithEmail(payload);
    navigate("/home");
  }

  return (
    <AppShell
      eyebrow="Login"
      title={platformIdentity.appName}
      description="One mobile-first app for Jenix IoT products with Google, Facebook, and email authentication prepared for JWT-based backend sessions."
      aside={<StatusPill label="Auth Base" tone="warning" />}
    >
      <section className="auth-grid">
        <article className="panel">
          <h2>Quick Access</h2>
          <div className="provider-stack">
            <GoogleLoginButton onPress={() => handleProviderLogin("google")} />
            <FacebookLoginButton onPress={() => handleProviderLogin("facebook")} />
          </div>
          <div className="meta-links">
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setNotice(
                  "Sign in with Google or Facebook to recover access instantly. For email accounts, reset help is on the way — contact support@iotsoft.in meanwhile."
                )
              }
            >
              Forgot password
            </button>
          </div>
          {notice ? <p className="provisioning-note">{notice}</p> : null}
        </article>
        <EmailLoginForm onSubmit={handleEmailLogin} />
        <SignupForm onSubmit={handleSignup} />
      </section>
    </AppShell>
  );
}
