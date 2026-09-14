import { useState } from "react";
import { Link } from "react-router-dom";

import { ApiResponseError } from "../../../app/authenticatedRequest";

export interface AuthSignupCardProps {
  onSubmit: (payload: {
    email: string;
    name: string;
    password: string;
  }) => Promise<void>;
}

export function AuthSignupCard({ onSubmit }: AuthSignupCardProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    try {
      await onSubmit({ name, email, password });
    } catch (submitError) {
      const message =
        submitError instanceof ApiResponseError && submitError.status === 409
          ? "An account already exists for that email. Try signing in instead."
          : "We couldn't create your account. Please try again.";
      setError(message);
    }
  }

  return (
    <>
      <form
        className="auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <label className="field">
          <span>Full name</span>
          <input
            required
            placeholder="Full name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Email address</span>
          <input
            required
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Create password</span>
          <input
            required
            type="password"
            placeholder="Create password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="primary-button auth-cta" type="submit">
          Create account
        </button>
      </form>
      {error ? <p className="auth-error">{error}</p> : null}
      <div className="auth-link-stack">
        <span className="auth-card-note">Already have an account?</span>
        <Link className="auth-link" to="/login">
          Sign in
        </Link>
      </div>
    </>
  );
}
