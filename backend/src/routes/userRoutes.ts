import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { userController } from "../controllers/userController";
import { updateProfileSchema } from "../models/schemas";

export const userRouter = Router();

userRouter.get("/search", authenticate, userController.searchUsers);
userRouter.get("/profile/me", authenticate, userController.getMe);
userRouter.put("/profile", authenticate, validate(updateProfileSchema), userController.updateProfile);
