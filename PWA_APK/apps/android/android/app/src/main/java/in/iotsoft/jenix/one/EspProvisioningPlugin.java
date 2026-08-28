package in.iotsoft.jenix.one;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;

import com.espressif.provisioning.DeviceConnectionEvent;
import com.espressif.provisioning.ESPConstants;
import com.espressif.provisioning.ESPDevice;
import com.espressif.provisioning.ESPProvisionManager;
import com.espressif.provisioning.listeners.ProvisionListener;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.greenrobot.eventbus.EventBus;
import org.greenrobot.eventbus.Subscribe;
import org.greenrobot.eventbus.ThreadMode;

/**
 * Wraps Espressif's esp-idf-provisioning-android SDK (real protocomm +
 * Security Scheme 2 / SRP6a over BLE) so the web app can drive QRunlock's
 * actual provisioning wire protocol instead of the plain-JSON stand-in
 * previously used by runBleHandshake(). See QRunlock/PROVISIONING.md
 * Section 10 for why this wraps the native SDK rather than reimplementing
 * SRP6a/protobuf in TypeScript.
 *
 * One device is provisioned at a time, matching the existing app UX
 * (bleProvisioningService.ts only ever drives one active BLE session).
 */
@CapacitorPlugin(name = "EspProvisioning")
public class EspProvisioningPlugin extends Plugin {

  private ESPDevice currentDevice;
  private PluginCall pendingConnectCall;

  @Override
  protected void handleOnDestroy() {
    super.handleOnDestroy();
    if (EventBus.getDefault().isRegistered(this)) {
      EventBus.getDefault().unregister(this);
    }
  }

  @PluginMethod
  public void connect(PluginCall call) {
    String macAddress = call.getString("macAddress");
    String serviceUuid = call.getString("serviceUuid");

    if (macAddress == null || macAddress.isEmpty()) {
      call.reject("macAddress is required");
      return;
    }
    if (serviceUuid == null || serviceUuid.isEmpty()) {
      call.reject("serviceUuid is required");
      return;
    }
    if (!hasBluetoothConnectPermission()) {
      call.reject("BLUETOOTH_CONNECT permission not granted");
      return;
    }

    BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
    if (adapter == null) {
      call.reject("Bluetooth is not available on this device");
      return;
    }

    BluetoothDevice bluetoothDevice;
    try {
      bluetoothDevice = adapter.getRemoteDevice(macAddress);
    } catch (IllegalArgumentException e) {
      call.reject("Invalid macAddress: " + macAddress, e);
      return;
    }

    if (!EventBus.getDefault().isRegistered(this)) {
      EventBus.getDefault().register(this);
    }

    ESPProvisionManager provisionManager = ESPProvisionManager.getInstance(getContext());
    currentDevice = provisionManager.createESPDevice(
        ESPConstants.TransportType.TRANSPORT_BLE,
        ESPConstants.SecurityType.SECURITY_2
    );

    pendingConnectCall = call;
    call.setKeepAlive(true);
    currentDevice.connectBLEDevice(bluetoothDevice, serviceUuid);
  }

  @Subscribe(threadMode = ThreadMode.MAIN)
  public void onDeviceConnectionEvent(DeviceConnectionEvent event) {
    PluginCall call = pendingConnectCall;

    if (call == null) {
      // Not awaiting a connect() result -- an unexpected disconnect during
      // an active session. Surface it so the web layer can react instead of
      // silently hanging on a dead BLE link.
      if (event.getEventType() == ESPConstants.EVENT_DEVICE_DISCONNECTED) {
        JSObject data = new JSObject();
        notifyListeners("deviceDisconnected", data);
      }
      return;
    }

    if (event.getEventType() == ESPConstants.EVENT_DEVICE_CONNECTED) {
      pendingConnectCall = null;
      JSObject result = new JSObject();
      result.put("connected", true);
      call.resolve(result);
    } else if (event.getEventType() == ESPConstants.EVENT_DEVICE_CONNECTION_FAILED) {
      pendingConnectCall = null;
      call.reject("BLE connection failed");
    }
    // EVENT_DEVICE_DISCONNECTED while a connect() is pending is ignored here;
    // the SDK follows it with EVENT_DEVICE_CONNECTION_FAILED when a connect
    // attempt itself fails.
  }

  @PluginMethod
  public void provision(PluginCall call) {
    if (currentDevice == null) {
      call.reject("No connected device -- call connect() first");
      return;
    }

    String username = call.getString("username");
    String pop = call.getString("pop");
    String ssid = call.getString("ssid");
    String passphrase = call.getString("passphrase", "");

    if (username == null || username.isEmpty()) {
      call.reject("username is required");
      return;
    }
    if (pop == null || pop.isEmpty()) {
      call.reject("pop is required");
      return;
    }
    if (ssid == null || ssid.isEmpty()) {
      call.reject("ssid is required");
      return;
    }

    currentDevice.setUserName(username);
    currentDevice.setProofOfPossession(pop);

    call.setKeepAlive(true);
    currentDevice.provision(ssid, passphrase, new ProvisionListener() {
      @Override
      public void createSessionFailed(Exception e) {
        call.reject("createSessionFailed: " + e.getMessage(), e);
      }

      @Override
      public void wifiConfigSent() {
        notifyStage("wifiConfigSent");
      }

      @Override
      public void wifiConfigFailed(Exception e) {
        call.reject("wifiConfigFailed: " + e.getMessage(), e);
      }

      @Override
      public void wifiConfigApplied() {
        notifyStage("wifiConfigApplied");
      }

      @Override
      public void wifiConfigApplyFailed(Exception e) {
        call.reject("wifiConfigApplyFailed: " + e.getMessage(), e);
      }

      @Override
      public void provisioningFailedFromDevice(ESPConstants.ProvisionFailureReason reason) {
        call.reject("provisioningFailedFromDevice: " + reason.toString());
      }

      @Override
      public void deviceProvisioningSuccess() {
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
      }

      @Override
      public void onProvisioningFailed(Exception e) {
        call.reject("onProvisioningFailed: " + e.getMessage(), e);
      }
    });
  }

  private void notifyStage(String stage) {
    JSObject data = new JSObject();
    data.put("stage", stage);
    notifyListeners("provisioningProgress", data);
  }

  @PluginMethod
  public void disconnect(PluginCall call) {
    if (currentDevice != null) {
      currentDevice.disconnectDevice();
      currentDevice = null;
    }
    pendingConnectCall = null;
    call.resolve();
  }

  private boolean hasBluetoothConnectPermission() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      // BLUETOOTH_CONNECT (API 31+) has no pre-S equivalent check needed --
      // legacy BLUETOOTH permission is normal-protection and granted at
      // install time.
      return true;
    }
    return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT)
        == PackageManager.PERMISSION_GRANTED;
  }
}
