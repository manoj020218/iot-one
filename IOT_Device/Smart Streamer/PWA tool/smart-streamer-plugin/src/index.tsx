import { host } from "./host";
import { SmartStreamerApp } from "./SmartStreamerApp";

host.registerPackage({
  packageId: "smart-streamer-plugin",
  version: "1.0.0",
  exports: {
    SmartStreamerApp
  }
});
