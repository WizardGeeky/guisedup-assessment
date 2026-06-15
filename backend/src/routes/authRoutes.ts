import { Router } from "express";
import { authController } from "../controllers/authController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
} from "../models/schemas";

export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), authController.register);
authRouter.post("/login", validate(loginSchema), authController.login);
authRouter.post("/refresh", validate(refreshSchema), authController.refresh);
authRouter.post("/logout", authenticate, validate(refreshSchema), authController.logout);
authRouter.get("/me", authenticate, authController.me);
authRouter.post("/forgot-password", validate(forgotPasswordSchema), authController.forgotPassword);
authRouter.post("/verify-otp", validate(verifyOtpSchema), authController.verifyOtp);
authRouter.post("/reset-password", validate(resetPasswordSchema), authController.resetPassword);
