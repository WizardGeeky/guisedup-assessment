import { Router } from "express";
import { authRouter } from "./authRoutes";
import { postRouter } from "./postRoutes";
import { feedRouter } from "./feedRoutes";
import { searchRouter } from "./searchRoutes";
import { interactionRouter } from "./interactionRoutes";
import { commentRouter } from "./commentRoutes";
import { notificationRouter } from "./notificationRoutes";
import { messageRouter } from "./messageRoutes";
import { userRouter } from "./userRoutes";

export const router = Router();

router.use("/auth", authRouter);
router.use("/posts", postRouter);
router.use("/posts/:postId/comments", commentRouter);
router.use("/feed", feedRouter);
router.use("/search", searchRouter);
router.use("/interactions", interactionRouter);
router.use("/notifications", notificationRouter);
router.use("/messages", messageRouter);
router.use("/users", userRouter);
