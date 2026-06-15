import { Request, Response, NextFunction } from "express";
import { searchService } from "../services/searchService";
import { sendSuccess } from "../utils/apiResponse";
import { BadRequestError } from "../utils/errors";

export const searchController = {
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req.query["q"] as string | undefined)?.trim();
      if (!query) throw new BadRequestError("Query parameter 'q' is required");

      const topK = parseInt((req.query["limit"] as string) ?? "10", 10);
      const results = await searchService.searchPosts(query, Math.min(topK, 50));

      sendSuccess(res, results, 200, {
        page: 1,
        pageSize: results.length,
        total: results.length,
        hasMore: false,
      });
    } catch (err) {
      next(err);
    }
  },
};
