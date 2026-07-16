import { useState } from "react";

import { Sheet } from "../../../app/components/Sheet";

export interface AuthEmailSheetProps {
  onClose: () => void;
  onSubmit: (payload: { email: string; password: string }) => Promise<void>;
  open: boolean;
}

export function AuthEmailSheet({
  onClose,
  onSubmit,
  open
}: AuthEmailSheetProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Sheet
      open={open}
      title="Sign in with email"
      subtitle="Use the same email linked to your homes and devices."
      onClose={onClose}
    >
      <form
        className="auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({ email, password });
        }}
      >
        <label className="field">
          <span>Email</span>
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
          Login to Jenix One
        </button>
      </form>
    </Sheet>
  );
}
