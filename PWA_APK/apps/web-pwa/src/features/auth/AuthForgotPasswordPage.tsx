import { platformIdentity } from "@jenix/shared";

import { AuthForgotPasswordCard } from "./components/AuthForgotPasswordCard";
import { AuthLayout } from "./components/AuthLayout";

export function AuthForgotPasswordPage() {
  return (
    <AuthLayout
      eyebrow="Recovery"
      title={`Reset your ${platformIdentity.appName} password`}
      description="Recover access using the email already linked to your Jenix account."
      footer={<span>Your home permissions stay attached to your account identity.</span>}
    >
      <AuthForgotPasswordCard />
    </AuthLayout>
  );
}
