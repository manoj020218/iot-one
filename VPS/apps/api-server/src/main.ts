import { createApp } from "./app";
import { readAppConfig } from "./config/env";
import { closeMongoClient, getMongoDb } from "./infrastructure/mongo";
import { useScenePersistenceStore } from "./modules/scenes/scene.model";
import { createMongoScenePersistenceStore } from "./modules/scenes/scene.mongo-store";
import { createSceneRuntimeScheduler } from "./modules/scenes/scene.scheduler";

async function bootstrap() {
  const config = readAppConfig();

  if (config.scenePersistenceMode === "mongodb") {
    const database = await getMongoDb(config.mongodbUri!);
    useScenePersistenceStore(await createMongoScenePersistenceStore(database));
    console.log("[api-server] scene persistence driver: mongodb");
  } else {
    console.log("[api-server] scene persistence driver: memory");
  }

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

  async function shutdown(signal: string) {
    console.log(`[api-server] received ${signal}, shutting down`);
    sceneRuntimeScheduler?.stop();
    server.close(async () => {
      await closeMongoClient();
      process.exit(0);
    });
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

bootstrap().catch(async (error: unknown) => {
  console.error("[api-server] bootstrap failed", error);
  await closeMongoClient();
  process.exit(1);
});
