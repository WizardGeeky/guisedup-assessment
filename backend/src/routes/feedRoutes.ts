import { Router } from "express";
import { feedController } from "../controllers/feedController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { feedQuerySchema } from "../models/schemas";

export const feedRouter = Router();

/**
 * @swagger
 * /api/feed:
 *   get:
 *     summary: Get personalized feed
 *     description: |
 *       Returns a ranked feed for the authenticated user using the Real Connections algorithm.
 *       Ranking factors: semantic similarity (35%), relationship depth (30%),
 *       authenticity score (20%), time decay (15%).
 *       Uses cursor-based pagination.
 *     tags: [Feed]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema: { type: string, format: uuid }
 *         description: Cursor for next page (from previous response meta.nextCursor)
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Ranked feed posts
 */
feedRouter.get("/", authenticate, validate(feedQuerySchema), feedController.getFeed);
