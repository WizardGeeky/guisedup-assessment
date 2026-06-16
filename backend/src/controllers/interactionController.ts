import { Request, Response, NextFunction } from "express";
import { interactionService } from "../services/interactionService";
import { sendCreated, sendSuccess } from "../utils/apiResponse";
import { InteractionType } from "@prisma/client";
import { getIo } from "../socket";

export const interactionController = {
  async logInteraction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId, type } = req.body as { postId: string; type: InteractionType };
      const userId = req.user!.userId;

      const { interaction, notifyUserId, reactorUsername } =
        await interactionService.logInteraction({ userId, postId, type });

      if (notifyUserId && reactorUsername) {
        try {
          getIo().to(`user:${notifyUserId}`).emit("new-notification", {
            type: "REACTION",
            message: `${reactorUsername} reacted to your post`,
            fromUser: { id: userId, username: reactorUsername, avatarUrl: null },
            postId,
            isRead: false,
          });
        } catch {
          // Socket not initialized
        }
      }

      sendCreated(res, interaction, "Interaction recorded");
    } catch (err) {
      next(err);
    }
  },

  async getPostInteractions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params as { postId: string };
      const counts = await interactionService.getPostInteractionCounts(postId);
      sendSuccess(res, counts);
    } catch (err) {
      next(err);
    }
  },
};
