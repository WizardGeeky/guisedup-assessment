import { Post } from "@prisma/client";
import { RankingStrategy, RankingContext, RankedPost } from "./strategies/types";
import { SemanticSimilarityStrategy } from "./strategies/SemanticSimilarityStrategy";
import { RelationshipDepthStrategy } from "./strategies/RelationshipDepthStrategy";
import { AuthenticityStrategy } from "./strategies/AuthenticityStrategy";
import { TimeDecayStrategy } from "./strategies/TimeDecayStrategy";
import { logger } from "../utils/logger";

type PostWithAuthor = Post & {
  author: { id: string; username: string; avatarUrl: string | null };
  _count?: { interactions: number };
};

/**
 * FeedRankingEngine — Strategy Pattern implementation.
 *
 * Final score formula:
 *   score = (0.35 × semantic) + (0.30 × relationship) + (0.20 × authenticity) + (0.15 × timeDecay)
 *
 * Each strategy is independently injectable, making it easy to:
 *   1. A/B test different weights
 *   2. Add new signals without changing core logic
 *   3. Unit test each dimension in isolation
 */
export class FeedRankingEngine {
  private readonly strategies: RankingStrategy[];

  constructor(strategies?: RankingStrategy[]) {
    this.strategies = strategies ?? [
      new SemanticSimilarityStrategy(),
      new RelationshipDepthStrategy(),
      new AuthenticityStrategy(),
      new TimeDecayStrategy(),
    ];

    // Validate weights sum to 1.0
    const totalWeight = this.strategies.reduce((sum, s) => sum + s.weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      logger.warn(`Ranking strategy weights sum to ${totalWeight}, expected 1.0`);
    }
  }

  /**
   * Rank a set of candidate posts for a given viewer.
   * Returns posts sorted by final score descending.
   */
  rank(posts: PostWithAuthor[], context: RankingContext): RankedPost[] {
    const ranked: RankedPost[] = posts.map((post) => {
      const scores = this.computeScores(post, context);
      return { post, scores };
    });

    return ranked.sort((a, b) => b.scores.final - a.scores.final);
  }

  private computeScores(
    post: PostWithAuthor,
    context: RankingContext,
  ): RankedPost["scores"] {
    let final = 0;
    const individualScores: Record<string, number> = {};

    for (const strategy of this.strategies) {
      const score = strategy.score(post, context);
      const clamped = Math.max(0, Math.min(1, score));
      individualScores[strategy.name] = clamped;
      final += strategy.weight * clamped;
    }

    return {
      semantic: individualScores["semantic"] ?? 0,
      relationship: individualScores["relationship"] ?? 0,
      authenticity: individualScores["authenticity"] ?? 0,
      timeDecay: individualScores["timeDecay"] ?? 0,
      final: Math.max(0, Math.min(1, final)),
    };
  }
}

export const feedRankingEngine = new FeedRankingEngine();
