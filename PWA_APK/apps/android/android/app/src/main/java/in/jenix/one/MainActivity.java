package in.jenix.one;

import android.graphics.Color;
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
    // The WebView paints its own default-white surface the instant it attaches,
    // before the page or its CSS has loaded, regardless of the window's own
    // background (see styles.xml). That white paint is what actually caused the
    // flash between the navy splash and real content - fix it at the source
    // instead of the theme.
    getBridge().getWebView().setBackgroundColor(Color.parseColor("#16233F"));
  }
}
