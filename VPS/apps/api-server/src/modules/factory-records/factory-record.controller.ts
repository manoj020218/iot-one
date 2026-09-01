import type { Request, Response } from "express";

import { saveFactoryRecord } from "./factory-record.service";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function saveFactoryRecordController(
  request: Request,
  response: Response
): Promise<void> {
  const body = request.body;

  if (!isRecord(body)) {
    response.status(400).json({ error: "Invalid factory record payload" });
    return;
  }

  const deviceId = readString(body, "deviceId");
  const pid = readString(body, "pid");
  const proofOfPossession = readString(body, "proofOfPossession");

  if (!deviceId || !pid || !proofOfPossession) {
    response.status(400).json({
      error: "deviceId, pid, and proofOfPossession are required"
    });
    return;
  }

  await saveFactoryRecord({
    deviceId,
    pid,
    proofOfPossession,
    capturedAt: new Date().toISOString()
  });

  response.status(201).json({ data: { deviceId } });
}
