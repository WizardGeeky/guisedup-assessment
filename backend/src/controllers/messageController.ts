import { Request, Response, NextFunction } from "express";
import { messageService } from "../services/messageService";
import { sendSuccess, sendCreated } from "../utils/apiResponse";
import { getIo } from "../socket";

export const messageController = {
  async getConversationList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const conversations = await messageService.getConversationList(userId);
      sendSuccess(res, conversations);
    } catch (err) {
      next(err);
    }
  },

  async getConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const viewerId = req.user!.userId;
      const { userId } = req.params as { userId: string };
      const messages = await messageService.getConversation(viewerId, userId);
      sendSuccess(res, messages);
    } catch (err) {
      next(err);
    }
  },

  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fromUserId = req.user!.userId;
      const { toUserId, text } = req.body as { toUserId: string; text: string };

      const message = await messageService.sendMessage(fromUserId, toUserId, text);

      // Emit real-time to recipient AND sender (sender sees own message instantly on all devices)
      try {
        const io = getIo();
        io.to(`user:${toUserId}`).emit("new-message", message);
        io.to(`user:${fromUserId}`).emit("new-message", message);
        io.to(`user:${toUserId}`).emit("new-notification", {
          type: "MESSAGE",
          message: `${message.fromUser.username} sent you a message`,
          fromUser: message.fromUser,
          isRead: false,
        });
      } catch {
        // Socket not initialized (test env)
      }

      sendCreated(res, message, "Message sent");
    } catch (err) {
      next(err);
    }
  },
};
