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

  return (
    <>
      <form
        className="auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({ email, password });
        }}
      >
        <label className="field">
          <span>Email address</span>
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="primary-button auth-cta" type="submit">
          Sign In
        </button>
      </form>
      <div className="auth-divider">or continue with</div>
      <GooglePrimaryAction onPress={onGoogle} />
      <div className="auth-link-stack">
        <div className="auth-link-row">
          <Link className="auth-link" to="/login/forgot-password">
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
