import { useState } from "react";
import { Link } from "react-router-dom";

export function AuthForgotPasswordCard() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <>
      <form
        className="auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          setSent(true);
        }}
      >
        <label className="field">
          <span>Account email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <button className="primary-button auth-cta" type="submit">
          Request password help
        </button>
      </form>
      {sent ? (
        <div className="auth-status-card">
          Recovery support is being enabled. If this email is already linked to your
          Jenix account, contact support@iotsoft.in for assisted access recovery.
        </div>
      ) : null}
      <div className="auth-link-stack">
        <Link className="auth-link" to="/login">
          Back to sign in
        </Link>
      </div>
    </>
  );
}
