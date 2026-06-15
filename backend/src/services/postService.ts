import { postRepository, PostWithAuthor } from "../repositories/postRepository";
import { embeddingJobRepository } from "../repositories/embeddingJobRepository";
import { embeddingQueue } from "../jobs/embeddingQueue";
import { computeAuthenticityScore } from "../ranking/strategies/AuthenticityStrategy";
import { NotFoundError } from "../utils/errors";

export interface CreatePostInput {
  authorId: string;
  text: string;
  imageUrl?: string;
}

export interface CreatePostResult {
  post: PostWithAuthor;
  embeddingStatus: "queued";
}

export const postService = {
  async createPost(input: CreatePostInput): Promise<CreatePostResult> {
    const authenticityScore = computeAuthenticityScore(input.text, input.imageUrl);

    const post = await postRepository.create({
      authorId: input.authorId,
      text: input.text,
      imageUrl: input.imageUrl,
      authenticityScore,
    });

    // Queue embedding generation (non-blocking)
    await embeddingJobRepository.create(post.id);
    embeddingQueue.enqueue({ postId: post.id });

    const postWithAuthor = await postRepository.findWithAuthor(post.id);
    if (!postWithAuthor) throw new NotFoundError("Post");

    return { post: postWithAuthor, embeddingStatus: "queued" };
  },

  async getPost(postId: string): Promise<PostWithAuthor> {
    const post = await postRepository.findWithAuthor(postId);
    if (!post) throw new NotFoundError("Post");
    return post;
  },

  async getUserPosts(userId: string): Promise<PostWithAuthor[]> {
    return postRepository.findByAuthor(userId);
  },
};
