import { Request, Response, NextFunction } from "express";
import { commentService } from "../services/commentService";
import { sendSuccess, sendCreated } from "../utils/apiResponse";
import { getIo } from "../socket";

export const commentController = {
  async getComments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params as { postId: string };
      const comments = await commentService.getComments(postId);
      sendSuccess(res, comments);
    } catch (err) {
      next(err);
    }
  },

  async addComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params as { postId: string };
      const { text } = req.body as { text: string };
      const authorId = req.user!.userId;

      const { comment, notifyUserId } = await commentService.addComment(postId, authorId, text);

      try {
        const io = getIo();
        io.to(`post:${postId}`).emit("new-comment", comment);
        if (notifyUserId) {
          io.to(`user:${notifyUserId}`).emit("new-notification", {
            type: "COMMENT",
            message: `${comment.author.username} commented on your post`,
            fromUser: comment.author,
            postId,
            isRead: false,
          });
        }
      } catch {
        // Socket not initialized (test env)
      }

      sendCreated(res, comment, "Comment added");
    } catch (err) {
      next(err);
    }
  },

  async deleteComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = req.user!.userId;
      await commentService.deleteComment(id, userId);
      sendSuccess(res, null, 200, undefined, "Comment deleted");
    } catch (err) {
      next(err);
    }
  },
};
