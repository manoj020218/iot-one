import { useState } from "react";
import { Link } from "react-router-dom";

import { GooglePrimaryAction } from "./GooglePrimaryAction";

export interface AuthLoginCardProps {
  onSubmit: (payload: { email: string; password: string }) => Promise<void>;
  onGoogle: () => Promise<void>;
}

export function AuthLoginCard({ onSubmit, onGoogle }: AuthLoginCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    try {
      await onSubmit({ email, password });
    } catch {
      setError("We couldn't sign you in with that email and password.");
    }
  }

  async function handleGoogle() {
    setError(null);
    try {
      await onGoogle();
    } catch {
      setError("Google sign-in didn't complete. Please try again.");
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
          <span>Password</span>
          <input
            required
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="primary-button auth-cta" type="submit">
          Continue
        </button>
      </form>
      {error ? <p className="auth-error">{error}</p> : null}
      <GooglePrimaryAction onPress={handleGoogle} />
      <div className="auth-link-stack">
        <div className="auth-link-row">
          <Link className="auth-link quiet" to="/login/forgot-password">
            Forgot password?
          </Link>
        </div>
        <span className="auth-card-note">
          New here? <Link className="auth-link" to="/login/signup">Create an account</Link>
        </span>
      </div>
    </>
  );
}
