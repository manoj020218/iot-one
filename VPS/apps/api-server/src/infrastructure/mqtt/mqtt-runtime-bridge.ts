import { connect, type IClientOptions, type MqttClient } from "mqtt";

import {
  buildDeviceTopic,
  buildDeviceTopicWildcard,
  buildLegacyCommandTopic,
  buildLegacyDeviceTopicWildcard,
  parseDeviceTopic,
  parseLegacyDeviceTopic
} from "@jenix/shared";

import type {
  RuntimeDeviceCommandAckMessage,
  RuntimeDeviceCommandMessage,
  RuntimeDeviceTopicMessage,
  RuntimeLegacyDeviceMessage,
  RuntimeMqttBridge,
  RuntimeNotificationMessage,
  RuntimeOtaAckMessage,
  RuntimeOtaRequestMessage,
  RuntimeScheduleTickMessage,
  RuntimeTelemetryIngressMessage
} from "./runtime.types";

/**
 * Only the two platform-internal topics remain statically configured. Every
 * device-facing topic (telemetry/status/events/cmd/cmd-ack/ota/ota-ack/lwt) is
 * built and parsed via the frozen jnx/{tenantId}/{pid}/{deviceId}/{suffix}
 * scheme in @jenix/shared — see mqtt-topics.ts and MQTT_LICENSED_DEVICE_ACCESS_PLAN.md.
 */
interface MqttRuntimeTopics {
  schedule: string;
  notification: string;
}

/** One legacy device family: a fixed topic root plus the suffixes that family
 *  actually publishes/subscribes (vocabularies differ per family — see
 *  buildLegacyDeviceTopic in @jenix/shared). */
export interface LegacyTopicFamily {
  topicRoot: string;
  suffixes: readonly string[];
}

export interface MqttRuntimeBridgeOptions {
  url: string;
  username?: string;
  password?: string;
  clientId: string;
  topics: MqttRuntimeTopics;
  logger?: (message: string) => void;
  onTelemetryMessage: (message: RuntimeTelemetryIngressMessage) => Promise<void>;
  onScheduleTickMessage: (message: RuntimeScheduleTickMessage) => Promise<void>;
  onDeviceCommandAckMessage: (
    message: RuntimeDeviceCommandAckMessage
  ) => Promise<void>;
  onOtaAckMessage: (message: RuntimeOtaAckMessage) => Promise<void>;
  /** Event-driven devices only (e.g. nurse call receiver) — optional, no-op if omitted. */
  onDeviceEventsMessage?: (message: RuntimeDeviceTopicMessage) => Promise<void>;
  onDeviceStatusMessage?: (message: RuntimeDeviceTopicMessage) => Promise<void>;
  /** Broker-published LWT ("{"status":"offline"}", retained) fired on an
   *  ungraceful disconnect — the only way the platform learns a device
   *  dropped off without a clean shutdown. Optional, no-op if omitted. */
  onDeviceLwtMessage?: (message: RuntimeDeviceTopicMessage) => Promise<void>;
  /**
   * Legacy device families to bridge, each with its own topic root and suffix
   * vocabulary — see JENIXONE_MQTT_HANDOFF.md. Empty/omitted means no legacy
   * devices are wired up.
   */
  legacyTopicRoots?: LegacyTopicFamily[];
  onLegacyDeviceMessage?: (message: RuntimeLegacyDeviceMessage) => Promise<void>;
  /**
   * Fixed global ack topics some already-flashed firmware still publishes to
   * (predates per-device ack topics — e.g. Tank Guard's real firmware, which
   * hardcodes jenix/runtime/commands/ack and jenix/runtime/ota/ack). The
   * payload shape on these topics already matches
   * RuntimeDeviceCommandAckMessage/RuntimeOtaAckMessage exactly, so they're
   * routed straight into the same onDeviceCommandAckMessage/onOtaAckMessage
   * handlers as the canonical per-device ack topics — no separate handler.
   */
  legacyGlobalAckTopics?: { commandAck: string; otaAck: string };
  /**
   * Arbitrary topic filters for device families whose real wire contract
   * doesn't fit either the canonical or legacyTopicRoots shape (e.g. Token
   * Dispenser's jenix/{tenantId}/{siteId}/{deviceId}/{suffix}, where
   * tenantId/siteId vary per device rather than being a fixed family root).
   * The bridge does no parsing here — onRawMessage gets the raw topic string
   * and payload and is responsible for recognizing what it owns.
   */
  rawSubscriptions?: string[];
  onRawMessage?: (topic: string, payload: Buffer) => Promise<void>;
}

function parseJsonMessage<T>(payload: Buffer): T {
  return JSON.parse(payload.toString("utf8")) as T;
}

function publishAsync(
  client: MqttClient,
  topic: string,
  payload: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    client.publish(topic, payload, { qos: 1 }, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function subscribeAsync(client: MqttClient, topic: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.subscribe(topic, { qos: 1 }, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function endAsync(client: MqttClient): Promise<void> {
  return new Promise((resolve) => {
    client.end(false, undefined, () => {
      resolve();
    });
  });
}

export class MqttRuntimeBridge implements RuntimeMqttBridge {
  private readonly url: string;
  private readonly options: IClientOptions;
  private readonly topics: MqttRuntimeTopics;
  private readonly logger: ((message: string) => void) | undefined;
  private readonly onTelemetryMessage: (
    message: RuntimeTelemetryIngressMessage
  ) => Promise<void>;
  private readonly onScheduleTickMessage: (
    message: RuntimeScheduleTickMessage
  ) => Promise<void>;
  private readonly onDeviceCommandAckMessage: (
    message: RuntimeDeviceCommandAckMessage
  ) => Promise<void>;
  private readonly onOtaAckMessage: (message: RuntimeOtaAckMessage) => Promise<void>;
  private readonly onDeviceEventsMessage:
    | ((message: RuntimeDeviceTopicMessage) => Promise<void>)
    | undefined;
  private readonly onDeviceStatusMessage:
    | ((message: RuntimeDeviceTopicMessage) => Promise<void>)
    | undefined;
  private readonly onDeviceLwtMessage:
    | ((message: RuntimeDeviceTopicMessage) => Promise<void>)
    | undefined;
  private readonly legacyTopicRoots: LegacyTopicFamily[];
  private readonly onLegacyDeviceMessage:
    | ((message: RuntimeLegacyDeviceMessage) => Promise<void>)
    | undefined;
  private readonly legacyGlobalAckTopics:
    | { commandAck: string; otaAck: string }
    | undefined;
  private readonly rawSubscriptions: string[];
  private readonly onRawMessage:
    | ((topic: string, payload: Buffer) => Promise<void>)
    | undefined;
  private client: MqttClient | null = null;
  private ready: Promise<void> | null = null;

  constructor(options: MqttRuntimeBridgeOptions) {
    this.url = options.url;
    this.options = {
      clean: true,
      reconnectPeriod: 5_000,
      ...(options.username ? { username: options.username } : {}),
      ...(options.password ? { password: options.password } : {}),
      clientId: options.clientId
    };
    this.topics = options.topics;
    this.logger = options.logger;
    this.onTelemetryMessage = options.onTelemetryMessage;
    this.onScheduleTickMessage = options.onScheduleTickMessage;
    this.onDeviceCommandAckMessage = options.onDeviceCommandAckMessage;
    this.onOtaAckMessage = options.onOtaAckMessage;
    this.onDeviceEventsMessage = options.onDeviceEventsMessage;
    this.onDeviceStatusMessage = options.onDeviceStatusMessage;
    this.onDeviceLwtMessage = options.onDeviceLwtMessage;
    this.legacyTopicRoots = options.legacyTopicRoots ?? [];
    this.onLegacyDeviceMessage = options.onLegacyDeviceMessage;
    this.legacyGlobalAckTopics = options.legacyGlobalAckTopics;
    this.rawSubscriptions = options.rawSubscriptions ?? [];
    this.onRawMessage = options.onRawMessage;
  }

  private registerMessageHandlers(client: MqttClient) {
    client.on("message", (topic, payload) => {
      void this.handleInboundMessage(topic, payload).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger?.(`[mqtt-runtime] failed to process inbound ${topic}: ${message}`);
      });
    });
  }

  private async handleLegacyInboundMessage(
    topic: string,
    payload: Buffer
  ): Promise<boolean> {
    if (!this.onLegacyDeviceMessage) {
      return false;
    }

    for (const family of this.legacyTopicRoots) {
      const parsedLegacy = parseLegacyDeviceTopic(topic, family.topicRoot);

      if (!parsedLegacy) {
        continue;
      }

      const rawPayload =
        parsedLegacy.suffix === "availability"
          ? payload.toString("utf8")
          : parseJsonMessage<unknown>(payload);

      await this.onLegacyDeviceMessage({
        topicRoot: parsedLegacy.topicRoot,
        deviceId: parsedLegacy.deviceId,
        suffix: parsedLegacy.suffix,
        payload: rawPayload
      });
      return true;
    }

    return false;
  }

  private async handleInboundMessage(topic: string, payload: Buffer): Promise<void> {
    if (topic === this.topics.schedule) {
      await this.onScheduleTickMessage(
        parseJsonMessage<RuntimeScheduleTickMessage>(payload)
      );
      return;
    }

    if (this.legacyGlobalAckTopics && topic === this.legacyGlobalAckTopics.commandAck) {
      await this.onDeviceCommandAckMessage(
        parseJsonMessage<RuntimeDeviceCommandAckMessage>(payload)
      );
      return;
    }

    if (this.legacyGlobalAckTopics && topic === this.legacyGlobalAckTopics.otaAck) {
      await this.onOtaAckMessage(parseJsonMessage<RuntimeOtaAckMessage>(payload));
      return;
    }

    if (await this.handleLegacyInboundMessage(topic, payload)) {
      return;
    }

    const parsedTopic = parseDeviceTopic(topic);

    if (!parsedTopic) {
      if (this.onRawMessage) {
        await this.onRawMessage(topic, payload);
      }
      return;
    }

    if (parsedTopic.suffix === "telemetry") {
      await this.onTelemetryMessage(
        parseJsonMessage<RuntimeTelemetryIngressMessage>(payload)
      );
      return;
    }

    if (parsedTopic.suffix === "cmd/ack") {
      await this.onDeviceCommandAckMessage(
        parseJsonMessage<RuntimeDeviceCommandAckMessage>(payload)
      );
      return;
    }

    if (parsedTopic.suffix === "ota/ack") {
      await this.onOtaAckMessage(
        parseJsonMessage<RuntimeOtaAckMessage>(payload)
      );
      return;
    }

    if (parsedTopic.suffix === "events" && this.onDeviceEventsMessage) {
      await this.onDeviceEventsMessage({
        tenantId: parsedTopic.tenantId,
        pid: parsedTopic.pid,
        deviceId: parsedTopic.deviceId,
        payload: parseJsonMessage<Record<string, unknown>>(payload)
      });
      return;
    }

    if (parsedTopic.suffix === "status" && this.onDeviceStatusMessage) {
      await this.onDeviceStatusMessage({
        tenantId: parsedTopic.tenantId,
        pid: parsedTopic.pid,
        deviceId: parsedTopic.deviceId,
        payload: parseJsonMessage<Record<string, unknown>>(payload)
      });
      return;
    }

    if (parsedTopic.suffix === "lwt" && this.onDeviceLwtMessage) {
      await this.onDeviceLwtMessage({
        tenantId: parsedTopic.tenantId,
        pid: parsedTopic.pid,
        deviceId: parsedTopic.deviceId,
        payload: parseJsonMessage<Record<string, unknown>>(payload)
      });
    }
  }

  async start(): Promise<void> {
    if (this.ready) {
      return this.ready;
    }

    this.ready = new Promise<void>((resolve, reject) => {
      const client = connect(this.url, this.options);
      this.client = client;

      const handleError = (error: Error) => {
        reject(error);
      };

      client.once("error", handleError);
      client.once("connect", () => {
        client.off("error", handleError);
        this.registerMessageHandlers(client);
        const deviceTopicSubscriptions = [
          buildDeviceTopicWildcard("telemetry"),
          buildDeviceTopicWildcard("cmd/ack"),
          buildDeviceTopicWildcard("ota/ack"),
          buildDeviceTopicWildcard("events"),
          buildDeviceTopicWildcard("status"),
          buildDeviceTopicWildcard("lwt")
        ];
        const legacyTopicSubscriptions = this.legacyTopicRoots.flatMap((family) =>
          family.suffixes.map((suffix) => buildLegacyDeviceTopicWildcard(family.topicRoot, suffix))
        );
        const legacyGlobalAckSubscriptions = this.legacyGlobalAckTopics
          ? [this.legacyGlobalAckTopics.commandAck, this.legacyGlobalAckTopics.otaAck]
          : [];
        const allSubscriptions = [
          ...deviceTopicSubscriptions,
          ...legacyTopicSubscriptions,
          ...legacyGlobalAckSubscriptions,
          ...this.rawSubscriptions,
          this.topics.schedule
        ];
        void Promise.all(allSubscriptions.map((topic) => subscribeAsync(client, topic)))
          .then(() => {
            this.logger?.(
              `[mqtt-runtime] connected and subscribed to ${allSubscriptions.join(", ")}`
            );
            resolve();
          })
          .catch(reject);
      });
    });

    return this.ready;
  }

  async stop(): Promise<void> {
    if (!this.client) {
      return;
    }

    await endAsync(this.client);
    this.client = null;
    this.ready = null;
  }

  private async requireClient(): Promise<MqttClient> {
    if (!this.ready) {
      throw new Error("MQTT runtime bridge is not started");
    }

    await this.ready;

    if (!this.client) {
      throw new Error("MQTT runtime client is unavailable");
    }

    return this.client;
  }

  private async publish(topic: string, payload: unknown): Promise<void> {
    const client = await this.requireClient();
    await publishAsync(client, topic, JSON.stringify(payload));
  }

  publishTelemetryIngress(message: RuntimeTelemetryIngressMessage): Promise<void> {
    const deviceId = message.job.deviceId;

    if (!deviceId) {
      throw new Error("Telemetry ingress message is missing a deviceId");
    }

    const topic = buildDeviceTopic(
      { tenantId: message.job.homeId, pid: message.pid, deviceId },
      "telemetry"
    );
    return this.publish(topic, message);
  }

  publishScheduleTick(message: RuntimeScheduleTickMessage): Promise<void> {
    return this.publish(this.topics.schedule, message);
  }

  publishDeviceCommand(message: RuntimeDeviceCommandMessage): Promise<void> {
    const topic = buildDeviceTopic(
      { tenantId: message.homeId, pid: message.pid, deviceId: message.deviceId },
      "cmd"
    );
    return this.publish(topic, message);
  }

  publishNotification(message: RuntimeNotificationMessage): Promise<void> {
    return this.publish(this.topics.notification, message);
  }

  publishOtaRequest(message: RuntimeOtaRequestMessage): Promise<void> {
    const topic = buildDeviceTopic(
      { tenantId: message.homeId, pid: message.pid, deviceId: message.deviceId },
      "ota"
    );
    return this.publish(topic, message);
  }

  publishLegacyDeviceCommand(input: {
    topicRoot: string;
    deviceId: string;
    actionSuffix: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const topic = buildLegacyCommandTopic(input.topicRoot, input.deviceId, input.actionSuffix);
    return this.publish(topic, input.payload);
  }

  publishRaw(topic: string, payload: unknown): Promise<void> {
    return this.publish(topic, payload);
  }
}

export function createMqttRuntimeBridge(
  options: MqttRuntimeBridgeOptions
): MqttRuntimeBridge {
  return new MqttRuntimeBridge(options);
}
