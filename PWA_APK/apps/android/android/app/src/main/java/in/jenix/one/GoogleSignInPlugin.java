package in.jenix.one;

import android.content.Intent;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

/**
 * Real native Google Sign-In (Play Services Auth SDK, account-picker UI),
 * not the Google Identity Services JS popup flow -- that flow's window.open()
 * never renders in a plain Capacitor WebView (no WebChromeClient.onCreateWindow
 * override), so sign-in silently times out. Adapted from the working
 * reference at D:\IOT Device\QRunlock\android\app\src\main\java\com\qrunlock\host\QRGoogleSignInPlugin.java.
 *
 * Yields an ID token (not an OAuth access token, unlike the web flow in
 * googleIdentity.ts) -- verified server-side via
 * VPS/apps/api-server/src/modules/auth/auth.google.ts's
 * verifyGoogleIdToken().
 */
@CapacitorPlugin(name = "GoogleSignIn")
public class GoogleSignInPlugin extends Plugin {
  private static final String TAG = "GoogleSignIn";
  private static final int SIGN_IN_CANCELLED = 12501;
  private static final int DEVELOPER_ERROR = 10;

  private GoogleSignInClient googleSignInClient;

  @Override
  public void load() {
    String webClientId = getContext().getString(R.string.server_client_id);

    GoogleSignInOptions options = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
        .requestEmail()
        .requestIdToken(webClientId)
        .build();

    googleSignInClient = GoogleSignIn.getClient(getContext(), options);
  }

  @PluginMethod
  public void signIn(PluginCall call) {
    if (googleSignInClient == null) {
      call.reject("Google Sign-In is not initialized");
      return;
    }

    if (getActivity() == null) {
      call.reject("Google Sign-In activity is unavailable");
      return;
    }

    int playServicesStatus = GoogleApiAvailability.getInstance()
        .isGooglePlayServicesAvailable(getActivity());
    if (playServicesStatus != ConnectionResult.SUCCESS) {
      call.reject("Google Play Services unavailable: " + playServicesStatus,
          String.valueOf(playServicesStatus));
      return;
    }

    Intent signInIntent = googleSignInClient.getSignInIntent();
    try {
      startActivityForResult(call, signInIntent, "handleSignInResult");
    } catch (Exception e) {
      call.reject("Failed to launch Google sign-in", e);
    }
  }

  @ActivityCallback
  protected void handleSignInResult(PluginCall call, ActivityResult result) {
    if (call == null) return;

    Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(result.getData());

    try {
      GoogleSignInAccount account = task.getResult(ApiException.class);

      JSObject user = new JSObject();
      user.put("idToken", account.getIdToken());
      user.put("email", account.getEmail());
      user.put("displayName", account.getDisplayName());

      call.resolve(user);
    } catch (ApiException e) {
      int statusCode = e.getStatusCode();
      Log.e(TAG, "handleSignInResult(): ApiException statusCode=" + statusCode, e);
      if (statusCode == SIGN_IN_CANCELLED) {
        call.reject("The user canceled the sign-in flow.", String.valueOf(statusCode));
      } else if (statusCode == DEVELOPER_ERROR) {
        call.reject(
            "Google sign-in configuration error (DEVELOPER_ERROR). Verify the Android package name and SHA-1 fingerprint in Google Cloud Console.",
            String.valueOf(statusCode)
        );
      } else {
        call.reject("Google sign-in failed: " + statusCode, String.valueOf(statusCode));
      }
    } catch (Exception e) {
      call.reject("Google sign-in failed", e);
    }
  }

  @PluginMethod
  public void signOut(PluginCall call) {
    if (googleSignInClient == null) {
      call.resolve();
      return;
    }
    googleSignInClient.signOut()
        .addOnSuccessListener(unused -> call.resolve())
        .addOnFailureListener(e -> call.reject("Google sign-out failed", e));
  }
}
