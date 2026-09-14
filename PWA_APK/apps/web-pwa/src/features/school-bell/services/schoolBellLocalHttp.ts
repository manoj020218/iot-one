import type { Capabilities } from "./schoolBellTypes";

/**
 * Low-level transport for talking directly to a School Bell device on the
 * local network — no VPS involved. Every call here fails fast (short
 * timeout) so the connection-mode hook can tell quickly whether the
 * device is actually reachable on this network right now, rather than
 * hanging for the browser's default multi-minute TCP timeout.
 */

export class LocalApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "LocalApiError";
  }
}

const DEFAULT_TIMEOUT_MS = 4000;
const PROBE_TIMEOUT_MS = 1500;

async function withTimeout<T>(timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(
  baseUrl: string,
  path: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const response = await withTimeout(timeoutMs, (signal) =>
    fetch(`${baseUrl}/api/v1${path}`, { ...init, signal })
  ).catch((error: unknown) => {
    const reason = error instanceof Error && error.name === "AbortError" ? "timed out" : "unreachable";
    throw new LocalApiError(`Could not reach the bell on the local network (${reason}).`);
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new LocalApiError(body || `Device returned ${response.status}`, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function localGet<T>(baseUrl: string, path: string): Promise<T> {
  return request<T>(baseUrl, path, { method: "GET" });
}

export function localPut<T>(baseUrl: string, path: string, body: unknown): Promise<T> {
  return request<T>(baseUrl, path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export function localPost<T>(baseUrl: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method: "POST", headers: { "Content-Type": "application/json" } };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return request<T>(baseUrl, path, init);
}

export function localDelete<T>(baseUrl: string, path: string): Promise<T> {
  return request<T>(baseUrl, path, { method: "DELETE" });
}

/** `path` is the upload route without its query string, e.g. "/internal/sounds" or "/festival/upload". */
export function localUploadFile<T>(baseUrl: string, path: string, fileName: string, file: Blob): Promise<T> {
  return request(baseUrl, `${path}?name=${encodeURIComponent(fileName)}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: file
  }, 60000);
}

/** Used purely as a fast reachability probe by the connection-mode hook. */
export async function probeLocalDevice(baseUrl: string): Promise<Capabilities | null> {
  try {
    return await request<Capabilities>(baseUrl, "/capabilities", { method: "GET" }, PROBE_TIMEOUT_MS);
  } catch {
    return null;
  }
}
