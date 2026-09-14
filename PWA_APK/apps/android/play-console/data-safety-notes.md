# Play Console — Data Safety form prep notes

**Read before submitting.** This is my best-effort read of what the *client
app* actually does, based on the manifest, native plugins, and the auth/
device code I could inspect in this repo. Google's Data Safety form is a
declaration about your whole system, including the backend server, which I
have not audited here (only the local dev copy, not what production
actually logs/retains/shares) — confirm backend practices match before you
submit this. Getting this form wrong is a real Play policy risk, not just a
formality.

## Permissions actually declared (merged release manifest, 2026-09-13)

| Permission | Why | Data safety implication |
|---|---|---|
| `INTERNET`, `ACCESS_NETWORK_STATE` | Talk to the Jenix One API/cloud | Standard, not itself a data type to disclose |
| `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `BLUETOOTH`, `BLUETOOTH_ADMIN` | Discover and provision devices over BLE | Bluetooth scanning is generally not "location" if you use `neverForLocation` — confirm the bundled `@capacitor-community/bluetooth-le` AAR sets that flag; if it does, you likely do NOT need to declare location collection for this alone |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_WIFI_STATE` | Reading the phone's *currently connected Wi-Fi SSID* (to prefill the provisioning form) requires location permission on Android — there is no `neverForLocation`-style opt-out for this specific API | This is the one that needs a real decision: the app requests location permission and reads the SSID string, but (as far as I can see in this codebase) never reads GPS coordinates, never transmits precise location, and doesn't store location history. Whether Play's form wants this marked as "Location collected" depends on exactly how narrowly you read their definition — recommend marking Wi-Fi/network SSID access honestly rather than omitting it, and marking precise/coarse *location* itself as **not collected** since coordinates are never read |
| `RECORD_AUDIO` | School Bell's live push-to-talk streams the phone mic directly to the device over the local network (`SOFT_PTT_CONTRACT.md`) | Audio is captured and streamed live to the user's own device, not uploaded to or stored on Jenix's servers, and not shared with third parties, as far as this code shows |

## Account / identity data

- Email address and password (or Google account identity via native
  Sign-In) — collected for authentication, stored by the Jenix One backend.
- No data observed being shared with third parties for advertising or
  cross-app tracking.

## What this app does NOT do (checked, not assumed)

- No ad SDK, no analytics SDK, no crash-reporting SDK in `android/app/
  build.gradle` or `package.json` as of 2026-09-14 (grepped for Firebase/
  Crashlytics/AdMob/Facebook/Mixpanel/Amplitude/Sentry — none present).
- No payments/financial data handled by this app.

## Recommended Data Safety form answers (draft, confirm before submitting)

- **Data collected**: Email address (account management), App activity /
  device data you choose to disclose for your device telemetry (confirm
  with backend team what's actually persisted server-side).
- **Data shared with third parties**: None observed.
- **Data encrypted in transit**: Yes, if your API is served over HTTPS in
  production (confirm — this matters for the checkbox).
- **Users can request data deletion**: Confirm your backend actually
  supports this before checking "yes" — Play increasingly checks this claim.
