import { Request, Response, NextFunction } from "express";
import { feedService } from "../services/feedService";
import { sendSuccess } from "../utils/apiResponse";

export const feedController = {
  async getFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const viewerUserId = req.user!.userId;
      const cursor = req.query["cursor"] as string | undefined;
      const limit = parseInt((req.query["limit"] as string) ?? "20", 10);

      const feedPage = await feedService.getFeed(viewerUserId, cursor, limit);

      sendSuccess(res, feedPage.posts, 200, {
        page: 1,
        pageSize: feedPage.posts.length,
        total: -1, // Unknown total for cursor-based pagination
        hasMore: feedPage.hasMore,
        nextCursor: feedPage.nextCursor ?? undefined,
      });
    } catch (err) {
      next(err);
    }
  },
};
