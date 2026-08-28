package in.iotsoft.jenix.one;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(EspProvisioningPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
