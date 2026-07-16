import { platformIdentity } from "@jenix/shared";
import { useNavigate } from "react-router-dom";

import { AuthLayout } from "./components/AuthLayout";
import { AuthSignupCard } from "./components/AuthSignupCard";
import { useAuth } from "./hooks/useAuth";

export function AuthSignupPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  return (
    <AuthLayout
      eyebrow="Create Account"
      title={`Set up your ${platformIdentity.appName} access`}
      description="Create one account for your homes, devices, and invited member access."
      footer={<span>Your account stays linked to every home you are invited into.</span>}
    >
      <AuthSignupCard
        onSubmit={async (payload) => {
          await auth.signupWithEmail(payload);
          navigate("/home");
        }}
      />
    </AuthLayout>
  );
}
