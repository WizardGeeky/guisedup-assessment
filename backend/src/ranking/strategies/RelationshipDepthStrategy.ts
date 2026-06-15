import { Post } from "@prisma/client";
import { RankingStrategy, RankingContext } from "./types";

/**
 * Relationship depth: how genuinely has the viewer engaged with this author?
 *
 * A reply > reaction > view in terms of depth signal — but all are weighted by
 * frequency. We normalize against the max depth in the current feed batch so
 * the score is always [0, 1].
 *
 * Weight: 0.30 — second highest because authentic engagement is the core product value.
 */
export class RelationshipDepthStrategy implements RankingStrategy {
  name = "relationship";
  weight = 0.30;

  score(post: Post, context: RankingContext): number {
    const rawDepth = context.relationshipDepths.get(post.authorId) ?? 0;

    if (rawDepth === 0) return 0.1; // Cold start: slight boost so new authors aren't invisible

    if (context.maxDepthScore === 0) return 0.1;

    // Log-scale to prevent one author dominating
    const logDepth = Math.log1p(rawDepth);
    const logMax = Math.log1p(context.maxDepthScore);

    return Math.max(0, Math.min(1, logDepth / logMax));
  }
}
