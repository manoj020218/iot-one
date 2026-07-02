import { createApp } from "./app";
import { readAppConfig } from "./config/env";
import { createSceneRuntimeScheduler } from "./modules/scenes/scene.scheduler";

const config = readAppConfig();
const app = createApp();
const sceneRuntimeScheduler = config.sceneSchedulerEnabled
  ? createSceneRuntimeScheduler({
      intervalMs: config.sceneSchedulerIntervalMs,
      logger: (message) => console.log(message)
    })
  : null;

const server = app.listen(config.port, () => {
  console.log(
    `[api-server] listening on port ${config.port} in ${config.nodeEnv} mode`
  );

  if (sceneRuntimeScheduler) {
    sceneRuntimeScheduler.start();
    console.log(
      `[api-server] scene scheduler enabled with ${config.sceneSchedulerIntervalMs}ms interval`
    );
  }
});

function shutdown(signal: string) {
  console.log(`[api-server] received ${signal}, shutting down`);
  sceneRuntimeScheduler?.stop();
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
