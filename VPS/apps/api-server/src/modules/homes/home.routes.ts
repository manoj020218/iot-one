import { Router, type Router as ExpressRouter } from "express";

import {
  createHomeController,
  createHomeShareCodeController,
  deleteHomeController,
  getHomeDashboardController,
  getHomeUiBootstrapController,
  leaveHomeController,
  listHomeMembersController,
  listHomesController,
  listHomeShareCodesController,
  redeemHomeShareCodeController,
  revokeHomeMemberController,
  updateHomeController,
  updateHomeMemberAccessController,
  updateHomeMemberRoleController
} from "./home.controller";

export const homeRouter: ExpressRouter = Router();

homeRouter.get("/", listHomesController);
homeRouter.post("/", createHomeController);
homeRouter.post("/redeem", redeemHomeShareCodeController);
homeRouter.get("/:homeId/dashboard", getHomeDashboardController);
homeRouter.get("/:homeId/ui-bootstrap", getHomeUiBootstrapController);
homeRouter.get("/:homeId/members", listHomeMembersController);
homeRouter.patch("/:homeId", updateHomeController);
homeRouter.delete("/:homeId", deleteHomeController);
homeRouter.post("/:homeId/leave", leaveHomeController);
homeRouter.patch("/:homeId/members/:userId", updateHomeMemberRoleController);
homeRouter.patch("/:homeId/members/:userId/access", updateHomeMemberAccessController);
homeRouter.delete("/:homeId/members/:userId", revokeHomeMemberController);
homeRouter.get("/:homeId/share-codes", listHomeShareCodesController);
homeRouter.post("/:homeId/share-codes", createHomeShareCodeController);
