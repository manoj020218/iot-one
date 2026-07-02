import type { Request, Response } from "express";

import { PidModuleError } from "./pid.types";
import { getPublicPid } from "./pid.service";

function sendError(response: Response, error: unknown) {
  if (error instanceof PidModuleError) {
    response.status(error.statusCode).json({
      error: error.message
    });
    return;
  }

  response.status(500).json({
    error: "Internal PID module error"
  });
}

export async function getPublicPidController(request: Request, response: Response) {
  try {
    response.status(200).json({
      data: await getPublicPid(request.params.pid ?? "")
    });
  } catch (error) {
    sendError(response, error);
  }
}
