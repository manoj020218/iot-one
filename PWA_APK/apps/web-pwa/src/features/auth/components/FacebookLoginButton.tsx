export interface FacebookLoginButtonProps {
  onPress: () => Promise<void>;
}

export function FacebookLoginButton({ onPress }: FacebookLoginButtonProps) {
  return (
    <button className="provider-button" type="button" onClick={() => void onPress()}>
      Continue with Facebook
    </button>
  );
}
