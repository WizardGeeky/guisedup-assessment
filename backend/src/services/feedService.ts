import { postRepository, PostWithAuthor } from "../repositories/postRepository";
import { interactionRepository } from "../repositories/interactionRepository";
import { feedRankingEngine } from "../ranking/FeedRankingEngine";
import { vectorSearchService } from "../search/VectorSearchService";
import { RankingContext } from "../ranking/strategies/types";
import { RankedPost } from "../ranking/strategies/types";
import { logger } from "../utils/logger";

export interface FeedPage {
  posts: RankedPost[];
  nextCursor: string | null;
  hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 20;
const CANDIDATE_MULTIPLIER = 3; // Fetch 3× more candidates than page size for re-ranking

export const feedService = {
  async getFeed(viewerUserId: string, cursor?: string, limit = DEFAULT_PAGE_SIZE): Promise<FeedPage> {
    // Step 1: Fetch candidate posts from ALL users
    // The ranking engine boosts posts from closer relationships; candidate selection
    // must be open to everyone so users can discover new people.
    const candidateLimit = limit * CANDIDATE_MULTIPLIER;
    const candidates: PostWithAuthor[] = await postRepository.findRecentPosts(
      viewerUserId,
      cursor,
      candidateLimit,
    );

    if (candidates.length === 0) {
      return { posts: [], nextCursor: null, hasMore: false };
    }

    // Step 3: Build ranking context
    const authorIds = [...new Set(candidates.map((p) => p.authorId))];

    const [relationshipDepths, viewerEmbedding] = await Promise.all([
      interactionRepository.getRelationshipDepths(viewerUserId, authorIds),
      feedService.getViewerEmbedding(viewerUserId),
    ]);

    const maxDepthScore = Math.max(...Array.from(relationshipDepths.values()), 1);

    const context: RankingContext = {
      viewerUserId,
      viewerEmbedding,
      relationshipDepths,
      maxDepthScore,
    };

    // Step 4: Rank candidates
    const ranked = feedRankingEngine.rank(candidates, context);

    // Step 5: Paginate — take one extra to determine hasMore
    const pageItems = ranked.slice(0, limit + 1);
    const hasMore = pageItems.length > limit;
    const pagePosts = pageItems.slice(0, limit);

    const nextCursor =
      hasMore && pagePosts.length > 0 ? pagePosts[pagePosts.length - 1]!.post.id : null;

    logger.debug(
      `Feed for user ${viewerUserId}: ${candidates.length} candidates → ${pagePosts.length} ranked posts`,
    );

    return { posts: pagePosts, nextCursor, hasMore };
  },

  async getViewerEmbedding(viewerUserId: string): Promise<number[]> {
    try {
      // Use posts the viewer has reacted to or replied to as their interest signal
      const interactedPostIds = await feedService.getViewerInteractedPostIds(viewerUserId);
      return vectorSearchService.buildViewerInterestEmbedding(interactedPostIds);
    } catch (err) {
      logger.warn(`Failed to build viewer embedding for ${viewerUserId}:`, err);
      return [];
    }
  },

  async getViewerInteractedPostIds(viewerUserId: string): Promise<string[]> {
    const { prisma } = await import("../config/database");
    const interactions = await prisma.interaction.findMany({
      where: {
        userId: viewerUserId,
        type: { in: ["REACTION", "REPLY"] },
      },
      select: { postId: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return [...new Set(interactions.map((i) => i.postId))];
  },
};
