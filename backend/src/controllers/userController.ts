import { Request, Response, NextFunction } from "express";
import { userRepository } from "../repositories/userRepository";
import { sendSuccess } from "../utils/apiResponse";

export const userController = {
  async searchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q } = req.query as { q?: string };
      const viewerId = req.user!.userId;
      if (!q || q.trim().length === 0) {
        sendSuccess(res, []);
        return;
      }
      const users = await userRepository.searchByUsername(q.trim(), viewerId);
      sendSuccess(res, users);
    } catch (err) {
      next(err);
    }
  },

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const user = await userRepository.findPublicById(userId);
      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }
      sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { bio, avatarUrl } = req.body as { bio?: string; avatarUrl?: string };

      const patch: { bio?: string; avatarUrl?: string } = {};
      if (bio !== undefined) patch.bio = bio;
      if (avatarUrl !== undefined) patch.avatarUrl = avatarUrl;

      const updated = await userRepository.update(userId, patch);

      sendSuccess(res, {
        id: updated.id,
        email: updated.email,
        username: updated.username,
        avatarUrl: updated.avatarUrl,
        bio: updated.bio,
      });
    } catch (err) {
      next(err);
    }
  },
};
