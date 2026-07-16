import { GooglePrimaryAction } from "./GooglePrimaryAction";

export interface AuthQuickAccessCardProps {
  onEmail: () => void;
  onForgotPassword: () => void;
  onGoogle: () => Promise<void>;
  onSignup: () => void;
}

export function AuthQuickAccessCard({
  onEmail,
  onForgotPassword,
  onGoogle,
  onSignup
}: AuthQuickAccessCardProps) {
  return (
    <>
      <div className="auth-actions">
        <GooglePrimaryAction onPress={onGoogle} />
      </div>
      <div className="auth-link-row">
        <button className="auth-link" type="button" onClick={onEmail}>
          Use email address
        </button>
        <button className="auth-link" type="button" onClick={onSignup}>
          Create new account
        </button>
      </div>
      <div className="auth-link-stack">
        <button className="auth-link muted" type="button" onClick={onForgotPassword}>
          Forgot password?
        </button>
        <span className="auth-card-note">
          Your home access stays linked to your account.
        </span>
      </div>
    </>
  );
}
