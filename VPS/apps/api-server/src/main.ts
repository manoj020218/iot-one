import { createApp } from "./app";
import { readAppConfig } from "./config/env";

const config = readAppConfig();
const app = createApp();

app.listen(config.port, () => {
  console.log(
    `[api-server] listening on port ${config.port} in ${config.nodeEnv} mode`
  );
});
