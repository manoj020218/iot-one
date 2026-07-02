import { useState } from "react";

export interface SignupFormProps {
  onSubmit: (payload: {
    name: string;
    email: string;
    password: string;
  }) => Promise<void>;
}

export function SignupForm({ onSubmit }: SignupFormProps) {
  const [name, setName] = useState("Asha");
  const [email, setEmail] = useState("asha@example.com");
  const [password, setPassword] = useState("Password123!");

  return (
    <form
      className="form-card"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({ name, email, password });
      }}
    >
      <h2>Email Signup</h2>
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
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
        Create Account
      </button>
    </form>
  );
}
