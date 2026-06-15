import { Router } from "express";
import { interactionController } from "../controllers/interactionController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { interactionSchema } from "../models/schemas";

export const interactionRouter = Router();

/**
 * @swagger
 * /api/interactions:
 *   post:
 *     summary: Log a user interaction
 *     description: |
 *       Records a user interaction (VIEW, REPLY, REACTION) against a post.
 *       Interactions feed the relationship-depth ranking signal.
 *       VIEW is idempotent — only recorded once per user per post.
 *     tags: [Interactions]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [postId, type]
 *             properties:
 *               postId: { type: string, format: uuid }
 *               type: { type: string, enum: [VIEW, REPLY, REACTION] }
 *     responses:
 *       201:
 *         description: Interaction recorded successfully
 */
interactionRouter.post(
  "/",
  authenticate,
  validate(interactionSchema),
  interactionController.logInteraction,
);

interactionRouter.get(
  "/post/:postId",
  authenticate,
  interactionController.getPostInteractions,
);
