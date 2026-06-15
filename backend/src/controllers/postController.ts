import { Request, Response, NextFunction } from "express";
import { postService } from "../services/postService";
import { sendCreated, sendSuccess } from "../utils/apiResponse";

export const postController = {
  async createPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { text, imageUrl } = req.body as { text: string; imageUrl?: string };
      const authorId = req.user!.userId;

      const result = await postService.createPost({ authorId, text, imageUrl });
      sendCreated(res, result, "Post created successfully");
    } catch (err) {
      next(err);
    }
  },

  async getPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const post = await postService.getPost(id);
      sendSuccess(res, post);
    } catch (err) {
      next(err);
    }
  },

  async getUserPosts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const posts = await postService.getUserPosts(userId);
      sendSuccess(res, posts);
    } catch (err) {
      next(err);
    }
  },

  async updatePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { text } = req.body as { text: string };
      const userId = req.user!.userId;
      const post = await postService.updatePost(id, userId, text);
      sendSuccess(res, post, "Post updated successfully");
    } catch (err) {
      next(err);
    }
  },

  async deletePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = req.user!.userId;
      await postService.deletePost(id, userId);
      sendSuccess(res, null, "Post deleted successfully");
    } catch (err) {
      next(err);
    }
  },
};
