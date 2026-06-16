import { Comment } from "@prisma/client";
import { prisma } from "../config/database";

export type CommentWithAuthor = Comment & {
  author: { id: string; username: string; avatarUrl: string | null };
};

export const commentRepository = {
  async findByPost(postId: string): Promise<CommentWithAuthor[]> {
    return prisma.comment.findMany({
      where: { postId },
      include: { author: { select: { id: true, username: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    }) as Promise<CommentWithAuthor[]>;
  },

  async create(postId: string, authorId: string, text: string): Promise<CommentWithAuthor> {
    return prisma.comment.create({
      data: { postId, authorId, text },
      include: { author: { select: { id: true, username: true, avatarUrl: true } } },
    }) as Promise<CommentWithAuthor>;
  },

  async delete(id: string, authorId: string): Promise<boolean> {
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment || comment.authorId !== authorId) return false;
    await prisma.comment.delete({ where: { id } });
    return true;
  },

  async countByPost(postId: string): Promise<number> {
    return prisma.comment.count({ where: { postId } });
  },
};
