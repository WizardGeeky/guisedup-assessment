import { vectorSearchService } from "../search/VectorSearchService";
import { postRepository, PostWithAuthor } from "../repositories/postRepository";
import { logger } from "../utils/logger";

export interface SearchResultPost {
  post: PostWithAuthor;
  relevanceScore: number;
}

export const searchService = {
  async searchPosts(query: string, topK = 10): Promise<SearchResultPost[]> {
    if (!query.trim()) return [];

    logger.info(`Semantic search: "${query}"`);

    // Step 1: Vector similarity search → get ranked post IDs with scores
    const searchResults = await vectorSearchService.search(query.trim(), topK);

    if (searchResults.length === 0) return [];

    // Step 2: Fetch full post data for matched IDs
    const postIds = searchResults.map((r) => r.postId);
    const posts = await postRepository.findManyByIds(postIds);

    // Step 3: Preserve search ranking order (post repository doesn't guarantee order)
    const postMap = new Map(posts.map((p) => [p.id, p]));

    return searchResults
      .map((result) => {
        const post = postMap.get(result.postId);
        if (!post) return null;
        return { post, relevanceScore: result.score };
      })
      .filter((item): item is SearchResultPost => item !== null);
  },
};
