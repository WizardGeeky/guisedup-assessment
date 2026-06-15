import { Interaction, InteractionType } from "@prisma/client";
import { prisma } from "../config/database";

export type CreateInteractionInput = {
  userId: string;
  postId: string;
  type: InteractionType;
};

export type InteractionCount = {
  postId: string;
  viewCount: number;
  replyCount: number;
  reactionCount: number;
  totalCount: number;
};

export const interactionRepository = {
  async upsert(data: CreateInteractionInput): Promise<Interaction> {
    return prisma.interaction.upsert({
      where: {
        userId_postId_type: {
          userId: data.userId,
          postId: data.postId,
          type: data.type,
        },
      },
      update: {},
      create: data,
    });
  },

  async countByPost(postId: string): Promise<InteractionCount> {
    const counts = await prisma.interaction.groupBy({
      by: ["type"],
      where: { postId },
      _count: { type: true },
    });

    const result: InteractionCount = {
      postId,
      viewCount: 0,
      replyCount: 0,
      reactionCount: 0,
      totalCount: 0,
    };

    for (const row of counts) {
      const count = row._count.type;
      if (row.type === "VIEW") result.viewCount = count;
      else if (row.type === "REPLY") result.replyCount = count;
      else if (row.type === "REACTION") result.reactionCount = count;
      result.totalCount += count;
    }

    return result;
  },

  // How many interactions has viewer done with a specific author's posts?
  async countBetweenUserAndAuthor(
    userId: string,
    authorId: string,
  ): Promise<number> {
    return prisma.interaction.count({
      where: {
        userId,
        post: { authorId },
      },
    });
  },

  // Get relationship depth scores for all authors the viewer has interacted with
  async getRelationshipDepths(
    viewerUserId: string,
    authorIds: string[],
  ): Promise<Map<string, number>> {
    const interactions = await prisma.interaction.groupBy({
      by: ["postId"],
      where: {
        userId: viewerUserId,
        post: { authorId: { in: authorIds } },
      },
      _count: { postId: true },
    });

    // Fetch the post → author mapping
    const postIds = interactions.map((i) => i.postId);
    const posts = await prisma.post.findMany({
      where: { id: { in: postIds } },
      select: { id: true, authorId: true },
    });

    const postAuthorMap = new Map(posts.map((p) => [p.id, p.authorId]));
    const depthMap = new Map<string, number>();

    for (const row of interactions) {
      const authorId = postAuthorMap.get(row.postId);
      if (authorId) {
        const current = depthMap.get(authorId) ?? 0;
        depthMap.set(authorId, current + row._count.postId);
      }
    }

    return depthMap;
  },

  // Authors the viewer has ever interacted with (for feed candidate selection)
  async getInteractedAuthorIds(viewerUserId: string): Promise<string[]> {
    const posts = await prisma.interaction.findMany({
      where: { userId: viewerUserId },
      select: { post: { select: { authorId: true } } },
      distinct: ["postId"],
    });

    const authorIds = [...new Set(posts.map((p) => p.post.authorId))];
    return authorIds.filter((id) => id !== viewerUserId);
  },
};
