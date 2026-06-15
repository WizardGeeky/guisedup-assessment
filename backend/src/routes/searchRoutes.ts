import { Router } from "express";
import { searchController } from "../controllers/searchController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { searchQuerySchema } from "../models/schemas";

export const searchRouter = Router();

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Natural language semantic search
 *     description: |
 *       Search posts using natural language. For example: "funny travel stories from last week"
 *       returns semantically relevant posts — not keyword matches.
 *       Uses vector cosine similarity against post embeddings.
 *     tags: [Search]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Natural language search query
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 10 }
 *     responses:
 *       200:
 *         description: Semantically ranked search results
 */
searchRouter.get("/", authenticate, validate(searchQuerySchema), searchController.search);
