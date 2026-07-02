import { Router, type Router as ExpressRouter } from "express";

import {
  createOtaReleaseController,
  getOtaReleaseController,
  listOtaReleasesController
} from "./ota.controller";

export const otaRouter: ExpressRouter = Router();

otaRouter.get("/releases", listOtaReleasesController);
otaRouter.post("/releases", createOtaReleaseController);
otaRouter.get("/releases/:releaseId", getOtaReleaseController);
