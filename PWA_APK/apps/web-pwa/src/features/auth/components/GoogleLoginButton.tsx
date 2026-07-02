export interface GoogleLoginButtonProps {
  onPress: () => Promise<void>;
}

export function GoogleLoginButton({ onPress }: GoogleLoginButtonProps) {
  return (
    <button className="provider-button" type="button" onClick={() => void onPress()}>
      Continue with Google
    </button>
  );
}
