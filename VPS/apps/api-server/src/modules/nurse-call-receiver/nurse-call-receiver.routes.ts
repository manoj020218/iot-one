import { Router, type Router as ExpressRouter } from "express";

import { requireAuthenticatedUser } from "../../infrastructure/http/request-auth";

import {
  attendCallController,
  dispatchNurseCallCommandController,
  listActiveCallsController,
  listCallHistoryController,
  listRemotesController,
  saveRemoteController
} from "./nurse-call-receiver.controller";

export const nurseCallReceiverRouter: ExpressRouter = Router();

nurseCallReceiverRouter.use(requireAuthenticatedUser);
nurseCallReceiverRouter.get("/:deviceId/nurse-call/remotes", listRemotesController);
nurseCallReceiverRouter.post("/:deviceId/nurse-call/remotes", saveRemoteController);
nurseCallReceiverRouter.get(
  "/:deviceId/nurse-call/calls/active",
  listActiveCallsController
);
nurseCallReceiverRouter.get(
  "/:deviceId/nurse-call/calls/history",
  listCallHistoryController
);
nurseCallReceiverRouter.post(
  "/:deviceId/nurse-call/calls/:callId/attend",
  attendCallController
);
nurseCallReceiverRouter.post(
  "/:deviceId/nurse-call/commands",
  dispatchNurseCallCommandController
);
