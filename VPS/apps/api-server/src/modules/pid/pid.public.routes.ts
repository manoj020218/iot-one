import { Router, type Router as ExpressRouter } from "express";

import { getPublicPidController } from "./pid.public.controller";

export const publicPidRouter: ExpressRouter = Router();

publicPidRouter.get("/:pid", getPublicPidController);
