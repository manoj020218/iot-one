export const platformIdentity = {
  projectName: "Jenix IoT Platform",
  appName: "Jenix One",
  apiPrefix: "/api/v1",
  webUrl: "https://one.jenix.in/app"
} as const;

/**
 * OAuth 2.0 Web Client ID for "Sign in with Google". Client IDs are meant to be
 * public (Google embeds them in every client-side app), so this is safe to ship
 * in the built bundle — it is not a secret. It must have `https://one.jenix.in`
 * listed under "Authorized JavaScript origins" in Google Cloud Console for the
 * owning project, or Google will reject the sign-in popup at runtime.
 */
export const googleWebClientId =
  "1096081783924-etthdttkand490a3s5p2v0g2ip6i9le6.apps.googleusercontent.com";

export const mobileTabs = [
  "Dashboard",
  "Scene",
  "Home Management",
  "Setting"
] as const;
