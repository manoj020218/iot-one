import { useState } from "react";

export interface EmailLoginFormProps {
  onSubmit: (payload: { email: string; password: string }) => Promise<void>;
}

export function EmailLoginForm({ onSubmit }: EmailLoginFormProps) {
  const [email, setEmail] = useState("operator@example.com");
  const [password, setPassword] = useState("Password123!");

  return (
    <form
      className="form-card"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({ email, password });
      }}
    >
      <h2>Email Login</h2>
      <label className="field">
        <span>Email</span>
        <input value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button className="primary-button" type="submit">
        Login with Email
      </button>
    </form>
  );
}
