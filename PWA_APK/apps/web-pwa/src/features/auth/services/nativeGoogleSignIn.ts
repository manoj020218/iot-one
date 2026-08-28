/**
 * TypeScript-facing wrapper for GoogleSignInPlugin.java (native Android) --
 * real Play Services account-picker sign-in, used instead of
 * googleIdentity.ts's popup-based flow when running inside the Capacitor
 * app. See GoogleSignInPlugin.java for why: Google Identity Services' JS
 * popup flow silently times out in a plain Capacitor WebView (no
 * WebChromeClient.onCreateWindow override, so window.open() never renders).
 */

export interface NativeGoogleSignInResult {
  idToken: string;
  email?: string;
  displayName?: string;
}

export interface NativeGoogleSignInPlugin {
  signIn: () => Promise<NativeGoogleSignInResult>;
  signOut: () => Promise<void>;
}

export function getNativeGoogleSignInPlugin(): NativeGoogleSignInPlugin | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = (
    window as Window & {
      Capacitor?: {
        Plugins?: {
          GoogleSignIn?: NativeGoogleSignInPlugin;
        };
      };
    }
  ).Capacitor?.Plugins?.GoogleSignIn;

  return candidate ?? null;
}

export async function requestNativeGoogleIdToken(): Promise<string> {
  const plugin = getNativeGoogleSignInPlugin();

  if (!plugin) {
    throw new Error("Native Google sign-in is unavailable right now");
  }

  const result = await plugin.signIn();

  if (!result.idToken) {
    throw new Error("Google sign-in did not return an ID token");
  }

  return result.idToken;
}
