import { hostname } from "node:os";

import type { Db } from "mongodb";

import { createApp } from "./app";
import { readAppConfig } from "./config/env";
import { createMqttRuntimeBridge } from "./infrastructure/mqtt/mqtt-runtime-bridge";
import {
  handleRuntimeDeviceCommandAckMessage,
  handleRuntimeOtaAckMessage,
  handleRuntimeScheduleTickMessage,
  handleRuntimeTelemetryIngressMessage
} from "./infrastructure/mqtt/runtime.handlers";
import { useRuntimeMqttBridge } from "./infrastructure/mqtt/runtime.binding";
import { closeMongoClient, getMongoDb } from "./infrastructure/mongo";
import { useApiAccessPersistenceStore } from "./modules/api-access/api-access.model";
import { createMongoApiAccessPersistenceStore } from "./modules/api-access/api-access.mongo-store";
import { useAuthPersistenceStore } from "./modules/auth/auth.model";
import { createMongoAuthPersistenceStore } from "./modules/auth/auth.mongo-store";
import { useDeviceRepository } from "./modules/devices/device.model";
import { createMongoDeviceRepository } from "./modules/devices/device.mongo-store";
import { useHomePersistenceStore } from "./modules/homes/home.model";
import { createMongoHomePersistenceStore } from "./modules/homes/home.mongo-store";
import {
  useOtaDeliveryJobRepository,
  useOtaRepository
} from "./modules/ota/ota.model";
import { createMongoOtaPersistenceStore } from "./modules/ota/ota.mongo-store";
import { createOtaDeliveryWorker } from "./modules/ota/ota.delivery-worker";
import { usePidPersistenceStore } from "./modules/pid/pid.model";
import { createMongoPidPersistenceStore } from "./modules/pid/pid.mongo-store";
import { useProvisioningRepository } from "./modules/provisioning/provisioning.model";
import { createMongoProvisioningRepository } from "./modules/provisioning/provisioning.mongo-store";
import { useScenePersistenceStore } from "./modules/scenes/scene.model";
import { createSceneActionDispatchWorker } from "./modules/scenes/scene.action-worker";
import { createMongoScenePersistenceStore } from "./modules/scenes/scene.mongo-store";
import {
  createLeaseBasedSceneSchedulerCoordinator,
  createLocalSceneSchedulerCoordinator
} from "./modules/scenes/scene.scheduler.coordinator";
import { createMongoSceneSchedulerLeaseStore } from "./modules/scenes/scene.scheduler.mongo-store";
import { createSceneRuntimeScheduler } from "./modules/scenes/scene.scheduler";
import { createSceneRuntimeEvaluationWorker } from "./modules/scenes/scene.runtime-worker";
import {
  createSceneRuntimeQueueResponse,
  enqueueScheduledSceneEvaluation,
  prepareScheduledSceneEvaluationJob
} from "./modules/scenes/scene.service";

async function bootstrap() {
  const config = readAppConfig();
  let database: Db | null = null;

  if (
    config.authPersistenceMode === "mongodb" ||
    config.homePersistenceMode === "mongodb" ||
    config.pidPersistenceMode === "mongodb" ||
    config.devicePersistenceMode === "mongodb" ||
    config.provisioningPersistenceMode === "mongodb" ||
    config.otaPersistenceMode === "mongodb" ||
    config.apiAccessPersistenceMode === "mongodb" ||
    config.scenePersistenceMode === "mongodb" ||
    config.sceneSchedulerCoordinationMode === "mongodb-lock"
  ) {
    database = await getMongoDb(config.mongodbUri!);
  }

  if (config.authPersistenceMode === "mongodb") {
    useAuthPersistenceStore(
      await createMongoAuthPersistenceStore(database!)
    );
    console.log("[api-server] auth persistence driver: mongodb");
  } else {
    console.log("[api-server] auth persistence driver: memory");
  }

  if (config.homePersistenceMode === "mongodb") {
    useHomePersistenceStore(
      await createMongoHomePersistenceStore(database!)
    );
    console.log("[api-server] home persistence driver: mongodb");
  } else {
    console.log("[api-server] home persistence driver: memory");
  }

  if (config.pidPersistenceMode === "mongodb") {
    usePidPersistenceStore(
      await createMongoPidPersistenceStore(database!)
    );
    console.log("[api-server] pid persistence driver: mongodb");
  } else {
    console.log("[api-server] pid persistence driver: memory");
  }

  if (config.devicePersistenceMode === "mongodb") {
    useDeviceRepository(
      await createMongoDeviceRepository(database!)
    );
    console.log("[api-server] device persistence driver: mongodb");
  } else {
    console.log("[api-server] device persistence driver: memory");
  }

  if (config.provisioningPersistenceMode === "mongodb") {
    useProvisioningRepository(
      await createMongoProvisioningRepository(database!)
    );
    console.log("[api-server] provisioning persistence driver: mongodb");
  } else {
    console.log("[api-server] provisioning persistence driver: memory");
  }

  if (config.otaPersistenceMode === "mongodb") {
    const otaPersistenceStore =
      await createMongoOtaPersistenceStore(database!);
    useOtaRepository(otaPersistenceStore.releases);
    useOtaDeliveryJobRepository(otaPersistenceStore.deliveryJobs);
    console.log("[api-server] ota persistence driver: mongodb");
  } else {
    console.log("[api-server] ota persistence driver: memory");
  }

  if (config.apiAccessPersistenceMode === "mongodb") {
    useApiAccessPersistenceStore(
      await createMongoApiAccessPersistenceStore(database!)
    );
    console.log("[api-server] api access persistence driver: mongodb");
  } else {
    console.log("[api-server] api access persistence driver: memory");
  }

  if (config.scenePersistenceMode === "mongodb") {
    useScenePersistenceStore(
      await createMongoScenePersistenceStore(database!)
    );
    console.log("[api-server] scene persistence driver: mongodb");
  } else {
    console.log("[api-server] scene persistence driver: memory");
  }

  const schedulerCoordinator =
    config.sceneSchedulerCoordinationMode === "mongodb-lock"
      ? createLeaseBasedSceneSchedulerCoordinator({
          ownerId:
            config.sceneSchedulerInstanceId ??
            `${hostname()}:${process.pid.toString()}`,
          leaseMs: config.sceneSchedulerLeaseMs,
          leaseStore: await createMongoSceneSchedulerLeaseStore(database!)
        })
      : createLocalSceneSchedulerCoordinator();
  const runtimeMqttBridge = config.mqttRuntimeEnabled
    ? createMqttRuntimeBridge({
        url: config.mqttUrl!,
        ...(config.mqttUsername ? { username: config.mqttUsername } : {}),
        ...(config.mqttPassword ? { password: config.mqttPassword } : {}),
        clientId: config.mqttClientId,
        topics: {
          telemetry: config.mqttTelemetryTopic,
          schedule: config.mqttScheduleTopic,
          deviceCommand: config.mqttDeviceCommandTopic,
          deviceCommandAck: config.mqttDeviceCommandAckTopic,
          notification: config.mqttNotificationTopic,
          otaRequest: config.mqttOtaRequestTopic,
          otaAck: config.mqttOtaAckTopic
        },
        logger: (message) => console.log(message),
        onTelemetryMessage: async (message) => {
          await handleRuntimeTelemetryIngressMessage(message);
        },
        onScheduleTickMessage: async (message) => {
          await handleRuntimeScheduleTickMessage(message);
        },
        onDeviceCommandAckMessage: async (message) => {
          await handleRuntimeDeviceCommandAckMessage(message);
        },
        onOtaAckMessage: async (message) => {
          await handleRuntimeOtaAckMessage(message);
        }
      })
    : null;

  useRuntimeMqttBridge(runtimeMqttBridge);

  const app = createApp();
  const sceneRuntimeScheduler = config.sceneSchedulerEnabled
    ? createSceneRuntimeScheduler({
        intervalMs: config.sceneSchedulerIntervalMs,
        logger: (message) => console.log(message),
        dispatchHomeTick: async (homeId, occurredAt) => {
          if (!runtimeMqttBridge) {
            return enqueueScheduledSceneEvaluation(
              { occurredAt },
              {
                homeId
              }
            );
          }

          const job = await prepareScheduledSceneEvaluationJob(
            { occurredAt },
            {
              homeId
            }
          );
          await runtimeMqttBridge.publishScheduleTick({
            job
          });

          return createSceneRuntimeQueueResponse([job]);
        },
        coordinator: schedulerCoordinator
      })
    : null;
  const sceneActionWorker = config.sceneActionWorkerEnabled
    ? createSceneActionDispatchWorker({
        workerId:
          config.sceneSchedulerInstanceId ??
          `${hostname()}:${process.pid.toString()}:scene-action-worker`,
        intervalMs: config.sceneActionWorkerIntervalMs,
        batchSize: config.sceneActionWorkerBatchSize,
        visibilityTimeoutMs: config.sceneActionWorkerVisibilityTimeoutMs,
        logger: (message) => console.log(message)
      })
    : null;
  const sceneRuntimeWorker = config.sceneRuntimeWorkerEnabled
    ? createSceneRuntimeEvaluationWorker({
        workerId:
          config.sceneSchedulerInstanceId ??
          `${hostname()}:${process.pid.toString()}:scene-runtime-worker`,
        intervalMs: config.sceneRuntimeWorkerIntervalMs,
        batchSize: config.sceneRuntimeWorkerBatchSize,
        visibilityTimeoutMs: config.sceneRuntimeWorkerVisibilityTimeoutMs,
        logger: (message) => console.log(message)
      })
    : null;
  const otaDeliveryWorker =
    config.otaDeliveryWorkerEnabled && runtimeMqttBridge
      ? createOtaDeliveryWorker({
          workerId:
            config.sceneSchedulerInstanceId ??
            `${hostname()}:${process.pid.toString()}:ota-delivery-worker`,
          intervalMs: config.otaDeliveryWorkerIntervalMs,
          batchSize: config.otaDeliveryWorkerBatchSize,
          visibilityTimeoutMs: config.otaDeliveryWorkerVisibilityTimeoutMs,
          logger: (message) => console.log(message)
        })
      : null;

  if (runtimeMqttBridge) {
    await runtimeMqttBridge.start();
  }

  const server = app.listen(config.port, () => {
    console.log(
      `[api-server] listening on port ${config.port} in ${config.nodeEnv} mode`
    );
    console.log(
      `[api-server] matter runtime enabled: ${config.matterRuntimeEnabled}`
    );
    if (runtimeMqttBridge) {
      console.log(
        `[api-server] mqtt runtime bridge enabled on ${config.mqttUrl} using topics ${config.mqttTelemetryTopic}, ${config.mqttScheduleTopic}, ${config.mqttDeviceCommandTopic}, ${config.mqttDeviceCommandAckTopic}, ${config.mqttOtaRequestTopic}, ${config.mqttOtaAckTopic}`
      );
    }

    if (sceneRuntimeScheduler) {
      sceneRuntimeScheduler.start();
      console.log(
        `[api-server] scene scheduler enabled with ${config.sceneSchedulerIntervalMs}ms interval`
      );
      console.log(
        `[api-server] scene scheduler coordination mode: ${config.sceneSchedulerCoordinationMode}`
      );
    }

    if (sceneActionWorker) {
      sceneActionWorker.start();
      console.log(
        `[api-server] scene action worker enabled with ${config.sceneActionWorkerIntervalMs}ms interval`
      );
    }

    if (sceneRuntimeWorker) {
      sceneRuntimeWorker.start();
      console.log(
        `[api-server] scene runtime worker enabled with ${config.sceneRuntimeWorkerIntervalMs}ms interval`
      );
    }

    if (otaDeliveryWorker) {
      otaDeliveryWorker.start();
      console.log(
        `[api-server] ota delivery worker enabled with ${config.otaDeliveryWorkerIntervalMs}ms interval`
      );
    }
  });

  async function shutdown(signal: string) {
    console.log(`[api-server] received ${signal}, shutting down`);
    sceneRuntimeScheduler?.stop();
    sceneRuntimeWorker?.stop();
    sceneActionWorker?.stop();
    otaDeliveryWorker?.stop();
    server.close(async () => {
      await runtimeMqttBridge?.stop();
      useRuntimeMqttBridge(null);
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
