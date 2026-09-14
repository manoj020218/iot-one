/**
 * One WebSocket talk session against /api/v1/announcement/ws, implementing
 * SOFT_PTT_CONTRACT.md exactly: open -> send {"type":"start",...} -> wait
 * for {"type":"ready"} -> binary PCM frames -> {"type":"stop"} -> wait for
 * {"type":"stopped"} -> close. The device also sends an "error" control
 * frame for anything invalid (session rejected because physical PTT is
 * already live, malformed control message, etc).
 */

export type AnnouncementSocketEvent =
  | { type: "ready" }
  | { type: "stopped" }
  | { type: "error"; message: string }
  | { type: "closed" };

type Listener = (event: AnnouncementSocketEvent) => void;

export class AnnouncementSocket {
  private ws: WebSocket | null = null;
  private readonly listeners = new Set<Listener>();

  constructor(private readonly wsUrl: string) {}

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: AnnouncementSocketEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  connect(): void {
    const socket = new WebSocket(this.wsUrl);
    socket.binaryType = "arraybuffer";
    this.ws = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "start", format: "pcm_s16le", sample_rate: 22050, channels: 1 }));
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      try {
        const message = JSON.parse(event.data) as { type?: string; message?: string };
        if (message.type === "ready") this.emit({ type: "ready" });
        else if (message.type === "stopped") this.emit({ type: "stopped" });
        else if (message.type === "error") this.emit({ type: "error", message: message.message ?? "The bell rejected this session" });
      } catch {
        // Not a control frame we understand — ignore rather than fail the session.
      }
    };

    socket.onerror = () => this.emit({ type: "error", message: "Could not reach the bell over the network" });
    socket.onclose = () => this.emit({ type: "closed" });
  }

  /** No-ops while the socket isn't open — a frame that arrives mid-connect or after close is safely dropped, not queued. */
  sendFrame(frame: Int16Array): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(frame);
    }
  }

  requestStop(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "stop" }));
    }
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
