import { Post } from "@prisma/client";
import { RankingStrategy, RankingContext } from "./types";
import { embeddingService } from "../../embeddings/EmbeddingService";

/**
 * Semantic similarity: how well does this post match the viewer's interest profile?
 *
 * Uses cosine similarity between the post's embedding and the viewer's aggregated
 * interest embedding (derived from posts they've reacted to or replied to).
 *
 * Weight: 0.35 — highest because it captures true interest alignment.
 */
export class SemanticSimilarityStrategy implements RankingStrategy {
  name = "semantic";
  weight = 0.35;

  score(post: Post, context: RankingContext): number {
    if (!post.embeddingVector || context.viewerEmbedding.length === 0) {
      // No embedding yet — fall back to 0.5 (neutral)
      return 0.5;
    }

    try {
      const postVector = embeddingService.deserialize(post.embeddingVector);
      const similarity = embeddingService.cosineSimilarity(
        postVector,
        context.viewerEmbedding,
      );
      return Math.max(0, Math.min(1, similarity));
    } catch {
      return 0.5;
    }
  }
}
