package in.jenix.one;

import android.Manifest;
import android.content.Context;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Reads the phone's currently-connected Wi-Fi SSID, so the provisioning
 * screen (WifiCredentialForm.tsx) can prefill it instead of asking the
 * installer to retype a network name they're already connected to (same
 * idea Tuya's app uses). Android gates WifiManager.getConnectionInfo()'s
 * SSID behind location permission regardless of API level or whether the
 * app otherwise avoids location for BLE (see bleDiscoveryService.ts's
 * androidNeverForLocation) -- SSID access specifically has no
 * neverForLocation-style opt-out.
 */
@CapacitorPlugin(
    name = "WifiInfo",
    permissions = {
        @Permission(strings = {Manifest.permission.ACCESS_FINE_LOCATION}, alias = "location")
    }
)
public class WifiInfoPlugin extends Plugin {

  @PluginMethod
  public void getCurrentSsid(PluginCall call) {
    if (getPermissionState("location") != PermissionState.GRANTED) {
      requestPermissionForAlias("location", call, "locationPermsCallback");
      return;
    }

    resolveSsid(call);
  }

  @PermissionCallback
  private void locationPermsCallback(PluginCall call) {
    if (getPermissionState("location") == PermissionState.GRANTED) {
      resolveSsid(call);
    } else {
      // Not a hard failure -- the form just falls back to manual entry.
      JSObject ret = new JSObject();
      ret.put("ssid", (Object) null);
      call.resolve(ret);
    }
  }

  private void resolveSsid(PluginCall call) {
    WifiManager wifiManager =
        (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);

    String ssid = null;
    if (wifiManager != null) {
      WifiInfo info = wifiManager.getConnectionInfo();
      if (info != null) {
        String rawSsid = info.getSSID();
        if (rawSsid != null && !rawSsid.isEmpty() && !rawSsid.equals("<unknown ssid>")) {
          // getSSID() wraps the name in double quotes for a normal
          // (non-hex) SSID -- strip them so the form shows/sends the
          // plain network name.
          ssid = rawSsid.startsWith("\"") && rawSsid.endsWith("\"") && rawSsid.length() >= 2
              ? rawSsid.substring(1, rawSsid.length() - 1)
              : rawSsid;
        }
      }
    }

    JSObject ret = new JSObject();
    ret.put("ssid", (Object) ssid);
    call.resolve(ret);
  }
}
