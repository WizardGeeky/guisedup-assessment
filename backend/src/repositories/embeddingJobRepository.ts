import { EmbeddingJob, EmbeddingJobStatus } from "@prisma/client";
import { prisma } from "../config/database";

export const embeddingJobRepository = {
  async create(postId: string): Promise<EmbeddingJob> {
    return prisma.embeddingJob.create({ data: { postId } });
  },

  async findByPostId(postId: string): Promise<EmbeddingJob | null> {
    return prisma.embeddingJob.findUnique({ where: { postId } });
  },

  async updateStatus(
    postId: string,
    status: EmbeddingJobStatus,
    error?: string,
  ): Promise<void> {
    await prisma.embeddingJob.update({
      where: { postId },
      data: {
        status,
        error: error ?? null,
        attempts: { increment: 1 },
      },
    });
  },

  async findPendingJobs(limit = 10): Promise<EmbeddingJob[]> {
    return prisma.embeddingJob.findMany({
      where: { status: "QUEUED", attempts: { lt: 3 } },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  },
};
