import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { commentController } from "../controllers/commentController";
import { createCommentSchema } from "../models/schemas";

export const commentRouter = Router({ mergeParams: true });

commentRouter.get("/", authenticate, commentController.getComments);
commentRouter.post("/", authenticate, validate(createCommentSchema), commentController.addComment);
commentRouter.delete("/:id", authenticate, commentController.deleteComment);
