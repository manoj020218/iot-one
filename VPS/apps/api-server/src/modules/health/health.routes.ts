import { Router, type Router as ExpressRouter } from "express";

import { getHealthSnapshot } from "./health.service";

export const healthRouter: ExpressRouter = Router();

healthRouter.get("/health", (_request, response) => {
  response.status(200).json({
    data: getHealthSnapshot()
  });
});
