import { platformIdentity } from "@jenix/shared";
import { AppShell, StatusPill } from "@jenix/ui";
import { useNavigate } from "react-router-dom";

import { useAuth } from "./hooks/useAuth";
import { EmailLoginForm } from "./components/EmailLoginForm";
import { FacebookLoginButton } from "./components/FacebookLoginButton";
import { GoogleLoginButton } from "./components/GoogleLoginButton";
import { SignupForm } from "./components/SignupForm";

export function AuthPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  async function handleProviderLogin(provider: "google" | "facebook") {
    await auth.loginWithProvider(provider);
    navigate("/dashboard");
  }

  async function handleEmailLogin(payload: { email: string; password: string }) {
    await auth.loginWithEmail(payload);
    navigate("/dashboard");
  }

  async function handleSignup(payload: {
    name: string;
    email: string;
    password: string;
  }) {
    await auth.signupWithEmail(payload);
    navigate("/dashboard");
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
            <button type="button" className="text-button">
              Forgot password
            </button>
          </div>
        </article>
        <EmailLoginForm onSubmit={handleEmailLogin} />
        <SignupForm onSubmit={handleSignup} />
      </section>
    </AppShell>
  );
}
