import { Request, Response, NextFunction } from "express";
import { interactionService } from "../services/interactionService";
import { sendCreated, sendSuccess } from "../utils/apiResponse";
import { InteractionType } from "@prisma/client";

export const interactionController = {
  async logInteraction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId, type } = req.body as { postId: string; type: InteractionType };
      const userId = req.user!.userId;

      const interaction = await interactionService.logInteraction({ userId, postId, type });
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
