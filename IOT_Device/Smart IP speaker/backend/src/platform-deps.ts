import type { NextFunction, Request, Response } from "express";
import type {
  DeviceRecord,
  DeviceUiCommandAckRecord,
  DeviceUiCommandRequest,
  HomeAccessRole
} from "@jenix/shared";

export interface IpSpeakerRequestContext {
  userId?: string;
  homeId?: string;
  homeRole?: HomeAccessRole;
}

export interface IpSpeakerPlatformDeps {
  requireAuthenticatedUser: (request: Request, response: Response, next: NextFunction) => void;
  requireAuthenticatedRequestUser: (request: Request) => { userId: string };
  readHomeIdFromRequest: (request: Request) => string | undefined;
  listDevices: (context: IpSpeakerRequestContext) => Promise<DeviceRecord[]>;
  getDevice: (deviceId: string, context: IpSpeakerRequestContext) => Promise<DeviceRecord>;
  dispatchDeviceUiCommand: (
    deviceId: string,
    payload: DeviceUiCommandRequest,
    context: IpSpeakerRequestContext
  ) => Promise<DeviceUiCommandAckRecord>;
}
