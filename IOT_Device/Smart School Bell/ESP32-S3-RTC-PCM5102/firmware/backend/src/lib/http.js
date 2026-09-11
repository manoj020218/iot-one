import { AppError } from "./app-error.js";

export function sendJson(response, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    ...extraHeaders
  });
  response.end(body);
}

export function sendText(response, statusCode, body, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    ...extraHeaders
  });
  response.end(body);
}

export function sendNoContent(response) {
  response.writeHead(204);
  response.end();
}

export async function readJsonBody(request, maxBytes) {
  const buffer = await readRequestBuffer(request, maxBytes);
  if (buffer.length === 0) {
    throw new AppError(400, "EMPTY_BODY", "Request body is required");
  }

  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body must be valid JSON");
  }
}

export async function readRequestBuffer(request, maxBytes) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new AppError(413, "PAYLOAD_TOO_LARGE", `Request exceeds ${maxBytes} bytes`));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", (error) => reject(error));
  });
}

export function getPublicBaseUrl(request, runtimeConfig) {
  if (runtimeConfig.publicBaseUrl) {
    return runtimeConfig.publicBaseUrl.replace(/\/+$/, "");
  }

  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = typeof forwardedProto === "string" && forwardedProto.length > 0
    ? forwardedProto.split(",")[0].trim()
    : "http";
  const host = request.headers["x-forwarded-host"] ?? request.headers.host ?? `127.0.0.1:${runtimeConfig.port}`;
  return `${protocol}://${String(host).trim()}`.replace(/\/+$/, "");
}

export function sendError(response, error) {
  if (response.writableEnded) return;

  if (error instanceof AppError) {
    sendJson(response, error.statusCode, {
      error: {
        code: error.code,
        message: error.message
      }
    });
    return;
  }

  sendJson(response, 500, {
    error: {
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Unexpected backend error"
    }
  });
}
