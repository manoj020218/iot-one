import { Router, type Router as ExpressRouter } from "express";

import {
  emailLoginController,
  emailSignupController,
  facebookLoginController,
  googleLoginController,
  logoutController,
  refreshTokenController
} from "./auth.controller";

export const authRouter: ExpressRouter = Router();

authRouter.post("/email/login", emailLoginController);
authRouter.post("/email/signup", emailSignupController);
authRouter.post("/google", googleLoginController);
authRouter.post("/facebook", facebookLoginController);
authRouter.post("/refresh", refreshTokenController);
authRouter.post("/logout", logoutController);
