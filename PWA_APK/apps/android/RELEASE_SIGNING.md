# Release signing

First Play Store release, generated 2026-08-30.

- Keystore: `C:\Users\User\jenix-one-release-signing\jenix-one-upload.jks`
  (outside this repo entirely, gitignored patterns in `android/.gitignore`
  are defense-in-depth only)
- Alias: `jenixone`
- Store/key password: same value (keytool forces PKCS12 keystores to use
  one password for both) - see
  `C:\Users\User\jenix-one-release-signing\CREDENTIALS_DO_NOT_LOSE.txt`
- SHA-1: `26:62:6A:D1:28:7C:AF:E2:BC:5F:91:F7:0A:CB:48:91:8E:7E:07:52`
  (register this with any Google Cloud OAuth client that needs to work in
  release builds, e.g. the native Google Sign-In `server_client_id` in
  `android/app/src/main/res/values/strings.xml` - it's currently only
  registered for the debug key)

`android/keystore.properties` (gitignored) points `app/build.gradle`'s
`signingConfigs.release` at the file above. Without that properties file,
`assembleRelease`/`bundleRelease` still work but produce an **unsigned**
build - the signing config is skipped, not defaulted to anything.

**If this keystore or its password is ever lost**: there is no recovery.
Play Store requires every future update to be signed with this exact
key - losing it means the `in.jenix.one` listing can never be updated
again, only replaced with a new app under a different package name.
Back up the keystore file and password somewhere durable and private
(password manager, encrypted drive) - the copy on this machine is not
enough.

## Building a release

```
cd PWA_APK/apps/android/android
./gradlew assembleRelease bundleRelease
```

Outputs:
- `app/build/outputs/apk/release/app-release.apk` - signed APK, useful
  for direct install/testing, not what Play Console wants for the
  production track.
- `app/build/outputs/bundle/release/app-release.aab` - signed Android
  App Bundle, upload this to Play Console.

Verify signing: `apksigner verify --print-certs app-release.apk` should
show `CN=Jenix One, ... C=IN` and the SHA-1 above.
