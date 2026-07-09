import { Router, type Router as ExpressRouter } from "express";

import {
  createHomeShareCodeController,
  getHomeUiBootstrapController,
  listHomeMembersController,
  listHomesController,
  listHomeShareCodesController,
  redeemHomeShareCodeController,
  revokeHomeMemberController,
  updateHomeMemberRoleController
} from "./home.controller";

export const homeRouter: ExpressRouter = Router();

homeRouter.get("/", listHomesController);
homeRouter.post("/redeem", redeemHomeShareCodeController);
homeRouter.get("/:homeId/ui-bootstrap", getHomeUiBootstrapController);
homeRouter.get("/:homeId/members", listHomeMembersController);
homeRouter.patch("/:homeId/members/:userId", updateHomeMemberRoleController);
homeRouter.delete("/:homeId/members/:userId", revokeHomeMemberController);
homeRouter.get("/:homeId/share-codes", listHomeShareCodesController);
homeRouter.post("/:homeId/share-codes", createHomeShareCodeController);
