package in.jenix.one;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    SplashScreen.installSplashScreen(this);
    registerPlugin(EspProvisioningPlugin.class);
    registerPlugin(GoogleSignInPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
