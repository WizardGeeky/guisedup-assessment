import { Router } from "express";
import { postController } from "../controllers/postController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createPostSchema, updatePostSchema } from "../models/schemas";

export const postRouter = Router();

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: Create a new post
 *     tags: [Posts]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text: { type: string, maxLength: 2000 }
 *               imageUrl: { type: string, format: uri }
 *     responses:
 *       201:
 *         description: Post created, embedding generation queued
 */
postRouter.post("/", authenticate, validate(createPostSchema), postController.createPost);

/**
 * @swagger
 * /api/posts/user/me:
 *   get:
 *     summary: Get authenticated user's posts
 *     tags: [Posts]
 *     security:
 *       - BearerAuth: []
 */
// Must be registered BEFORE /:id so Express doesn't treat "user" as an id param
postRouter.get("/user/me", authenticate, postController.getUserPosts);

/**
 * @swagger
 * /api/posts/{id}:
 *   get:
 *     summary: Get a specific post
 *     tags: [Posts]
 *     security:
 *       - BearerAuth: []
 */
postRouter.get("/:id", authenticate, postController.getPost);
postRouter.put("/:id", authenticate, validate(updatePostSchema), postController.updatePost);
postRouter.delete("/:id", authenticate, postController.deletePost);
