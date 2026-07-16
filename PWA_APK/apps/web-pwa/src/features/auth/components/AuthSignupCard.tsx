import { useState } from "react";
import { Link } from "react-router-dom";

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

  return (
    <>
      <form
        className="auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({ name, email, password });
        }}
      >
        <label className="field">
          <span>Full name</span>
          <input required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
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
          <span>Create password</span>
          <input
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="primary-button auth-cta" type="submit">
          Create account
        </button>
      </form>
      <div className="auth-link-stack">
        <span className="auth-card-note">Already have an account?</span>
        <Link className="auth-link" to="/login">
          Sign in
        </Link>
      </div>
    </>
  );
}
