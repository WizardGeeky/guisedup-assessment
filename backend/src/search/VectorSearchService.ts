import { embeddingService, EmbeddingVector } from "../embeddings/EmbeddingService";
import { postRepository } from "../repositories/postRepository";
import { logger } from "../utils/logger";

export interface SearchResult {
  postId: string;
  score: number;
}

/**
 * VectorSearchService — semantic search over posts.
 *
 * Current implementation: in-memory cosine similarity scan (suitable for <100k posts).
 *
 * Production path: replace with pgvector's <=> operator:
 *   SELECT id, 1 - (embedding_vector <=> $1::vector) AS score
 *   FROM posts
 *   ORDER BY embedding_vector <=> $1::vector
 *   LIMIT 10;
 *
 * Or use Pinecone/Qdrant for billion-scale search with ANN indexing.
 */
export class VectorSearchService {
  async search(query: string, topK = 10): Promise<SearchResult[]> {
    logger.debug(`Vector search: query="${query}", topK=${topK}`);

    const queryEmbedding = await embeddingService.generateEmbedding(query);
    const postsWithEmbeddings = await postRepository.findPostsWithEmbeddings();

    if (postsWithEmbeddings.length === 0) {
      return [];
    }

    const scored = postsWithEmbeddings
      .map((post) => {
        if (!post.embeddingVector) return null;
        try {
          const postVector = embeddingService.deserialize(post.embeddingVector);
          const score = embeddingService.cosineSimilarity(queryEmbedding, postVector);
          return { postId: post.id, score };
        } catch {
          return null;
        }
      })
      .filter((item): item is SearchResult => item !== null);

    // Sort by score descending, take topK
    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * Derive a viewer's interest profile embedding from their interaction history.
   * Averages embeddings of posts they've positively interacted with.
   */
  async buildViewerInterestEmbedding(interactedPostIds: string[]): Promise<EmbeddingVector> {
    if (interactedPostIds.length === 0) {
      return new Array(embeddingService.dimension).fill(0) as number[];
    }

    const posts = await postRepository.findManyByIds(interactedPostIds);
    const vectors: EmbeddingVector[] = [];

    for (const post of posts) {
      if (post.embeddingVector) {
        try {
          vectors.push(embeddingService.deserialize(post.embeddingVector));
        } catch {
          // skip malformed
        }
      }
    }

    if (vectors.length === 0) {
      return new Array(embeddingService.dimension).fill(0) as number[];
    }

    // Average the vectors
    const dim = vectors[0]!.length;
    const avg = new Array(dim).fill(0) as number[];

    for (const vec of vectors) {
      for (let i = 0; i < dim; i++) {
        avg[i] = (avg[i] ?? 0) + (vec[i] ?? 0);
      }
    }

    const len = vectors.length;
    return avg.map((v) => v / len);
  }
}

export const vectorSearchService = new VectorSearchService();
