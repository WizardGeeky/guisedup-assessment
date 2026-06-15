import { Router } from "express";
import { authRouter } from "./authRoutes";
import { postRouter } from "./postRoutes";
import { feedRouter } from "./feedRoutes";
import { searchRouter } from "./searchRoutes";
import { interactionRouter } from "./interactionRoutes";

export const router = Router();

router.use("/auth", authRouter);
router.use("/posts", postRouter);
router.use("/feed", feedRouter);
router.use("/search", searchRouter);
router.use("/interactions", interactionRouter);
