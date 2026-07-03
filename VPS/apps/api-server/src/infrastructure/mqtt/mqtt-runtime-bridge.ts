import { connect, type IClientOptions, type MqttClient } from "mqtt";

import type {
  RuntimeDeviceCommandAckMessage,
  RuntimeDeviceCommandMessage,
  RuntimeMqttBridge,
  RuntimeNotificationMessage,
  RuntimeOtaAckMessage,
  RuntimeOtaRequestMessage,
  RuntimeScheduleTickMessage,
  RuntimeTelemetryIngressMessage
} from "./runtime.types";

interface MqttRuntimeTopics {
  telemetry: string;
  schedule: string;
  deviceCommand: string;
  deviceCommandAck: string;
  notification: string;
  otaRequest: string;
  otaAck: string;
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
  }

  private registerMessageHandlers(client: MqttClient) {
    client.on("message", (topic, payload) => {
      void this.handleInboundMessage(topic, payload).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger?.(`[mqtt-runtime] failed to process inbound ${topic}: ${message}`);
      });
    });
  }

  private async handleInboundMessage(topic: string, payload: Buffer): Promise<void> {
    if (topic === this.topics.telemetry) {
      await this.onTelemetryMessage(
        parseJsonMessage<RuntimeTelemetryIngressMessage>(payload)
      );
      return;
    }

    if (topic === this.topics.schedule) {
      await this.onScheduleTickMessage(
        parseJsonMessage<RuntimeScheduleTickMessage>(payload)
      );
      return;
    }

    if (topic === this.topics.deviceCommandAck) {
      await this.onDeviceCommandAckMessage(
        parseJsonMessage<RuntimeDeviceCommandAckMessage>(payload)
      );
      return;
    }

    if (topic === this.topics.otaAck) {
      await this.onOtaAckMessage(
        parseJsonMessage<RuntimeOtaAckMessage>(payload)
      );
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
        void Promise.all([
          subscribeAsync(client, this.topics.telemetry),
          subscribeAsync(client, this.topics.schedule),
          subscribeAsync(client, this.topics.deviceCommandAck),
          subscribeAsync(client, this.topics.otaAck)
        ])
          .then(() => {
            this.logger?.(
              `[mqtt-runtime] connected and subscribed to ${this.topics.telemetry}, ${this.topics.schedule}, ${this.topics.deviceCommandAck}, ${this.topics.otaAck}`
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
    return this.publish(this.topics.telemetry, message);
  }

  publishScheduleTick(message: RuntimeScheduleTickMessage): Promise<void> {
    return this.publish(this.topics.schedule, message);
  }

  publishDeviceCommand(message: RuntimeDeviceCommandMessage): Promise<void> {
    return this.publish(this.topics.deviceCommand, message);
  }

  publishNotification(message: RuntimeNotificationMessage): Promise<void> {
    return this.publish(this.topics.notification, message);
  }

  publishOtaRequest(message: RuntimeOtaRequestMessage): Promise<void> {
    return this.publish(this.topics.otaRequest, message);
  }
}

export function createMqttRuntimeBridge(
  options: MqttRuntimeBridgeOptions
): MqttRuntimeBridge {
  return new MqttRuntimeBridge(options);
}
