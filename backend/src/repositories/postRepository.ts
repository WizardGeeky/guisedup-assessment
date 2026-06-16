import { Post, EmbeddingStatus } from "@prisma/client";
import { prisma } from "../config/database";

export type CreatePostInput = {
  authorId: string;
  text: string;
  imageUrl?: string;
  authenticityScore?: number;
};

export type PostWithAuthor = Post & {
  author: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  _count?: {
    interactions: number;
  };
};

export const postRepository = {
  async create(data: CreatePostInput): Promise<Post> {
    return prisma.post.create({ data });
  },

  async findById(id: string): Promise<Post | null> {
    return prisma.post.findUnique({ where: { id } });
  },

  async findWithAuthor(id: string): Promise<PostWithAuthor | null> {
    return prisma.post.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { interactions: true } },
      },
    });
  },

  async updateEmbedding(
    id: string,
    embeddingVector: string,
    status: EmbeddingStatus,
  ): Promise<void> {
    await prisma.post.update({
      where: { id },
      data: { embeddingVector, embeddingStatus: status },
    });
  },

  async updateEmbeddingStatus(id: string, status: EmbeddingStatus): Promise<void> {
    await prisma.post.update({
      where: { id },
      data: { embeddingStatus: status },
    });
  },

  async incrementViewCount(id: string): Promise<void> {
    await prisma.post.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
  },

  async findByAuthor(authorId: string, limit = 20): Promise<PostWithAuthor[]> {
    return prisma.post.findMany({
      where: { authorId },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { interactions: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }) as Promise<PostWithAuthor[]>;
  },

  // Fetch posts for feed candidates — all posts from users the viewer follows or interacts with
  async findFeedCandidates(
    viewerUserId: string,
    authorIds: string[],
    cursor?: string,
    limit = 20,
  ): Promise<PostWithAuthor[]> {
    return prisma.post.findMany({
      where: {
        authorId: { in: authorIds },
        // Exclude own posts
        NOT: { authorId: viewerUserId },
      },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { interactions: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    }) as Promise<PostWithAuthor[]>;
  },

  // All posts from other users, ordered by recency — used as the open candidate pool
  async findRecentPosts(
    excludeAuthorId: string,
    cursor?: string,
    limit = 20,
  ): Promise<PostWithAuthor[]> {
    return prisma.post.findMany({
      where: { NOT: { authorId: excludeAuthorId } },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { interactions: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }) as Promise<PostWithAuthor[]>;
  },

  // Fetch all posts with embeddings for vector search
  async findPostsWithEmbeddings(): Promise<Pick<Post, "id" | "text" | "authorId" | "embeddingVector" | "createdAt" | "authenticityScore">[]> {
    return prisma.post.findMany({
      where: { embeddingStatus: "DONE", embeddingVector: { not: null } },
      select: {
        id: true,
        text: true,
        authorId: true,
        embeddingVector: true,
        createdAt: true,
        authenticityScore: true,
      },
    });
  },

  async updatePost(id: string, authorId: string, text: string, imageUrl?: string | null): Promise<PostWithAuthor | null> {
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post || post.authorId !== authorId) return null;
    await prisma.post.update({
      where: { id },
      data: { text, ...(imageUrl !== undefined ? { imageUrl } : {}) },
    });
    return this.findWithAuthor(id);
  },

  async deletePost(id: string, authorId: string): Promise<boolean> {
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post || post.authorId !== authorId) return false;
    await prisma.post.delete({ where: { id } });
    return true;
  },

  // Get posts by IDs (for search results enrichment)
  async findManyByIds(ids: string[]): Promise<PostWithAuthor[]> {
    return prisma.post.findMany({
      where: { id: { in: ids } },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { interactions: true } },
      },
    }) as Promise<PostWithAuthor[]>;
  },
};
