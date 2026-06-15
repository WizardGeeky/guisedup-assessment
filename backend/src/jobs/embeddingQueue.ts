import { embeddingService } from "../embeddings/EmbeddingService";
import { embeddingJobRepository } from "../repositories/embeddingJobRepository";
import { postRepository } from "../repositories/postRepository";
import { logger } from "../utils/logger";

export interface EmbeddingJobPayload {
  postId: string;
}

/**
 * In-process embedding queue.
 *
 * Design: Simple async queue backed by a setInterval poll against the DB.
 * This is intentionally simple for the assessment — no Redis required.
 *
 * Production swap: Replace with BullMQ:
 *   const queue = new Queue("embeddings", { connection: redisClient });
 *   const worker = new Worker("embeddings", async (job) => { ... }, { connection: redisClient });
 *
 * The EmbeddingJob table in Postgres acts as a durable queue even with this simple approach —
 * if the process crashes, jobs are retried on restart because they remain QUEUED in the DB.
 */
class EmbeddingQueue {
  private pollInterval?: ReturnType<typeof setInterval>;
  private isProcessing = false;

  enqueue(payload: EmbeddingJobPayload): void {
    // Job is already persisted in the DB by the PostService before calling this.
    logger.debug(`Embedding job enqueued for post ${payload.postId}`);
  }

  startWorker(): void {
    logger.info("Embedding queue worker started (polling every 5s)");

    this.pollInterval = setInterval(async () => {
      if (this.isProcessing) return;
      await this.processBatch();
    }, 5000);
  }

  async close(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  private async processBatch(): Promise<void> {
    this.isProcessing = true;
    try {
      const jobs = await embeddingJobRepository.findPendingJobs(5);

      await Promise.allSettled(
        jobs.map((job) => this.processJob(job.postId)),
      );
    } catch (err) {
      logger.error("Embedding queue batch error:", err);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processJob(postId: string): Promise<void> {
    try {
      await embeddingJobRepository.updateStatus(postId, "PROCESSING");
      await postRepository.updateEmbeddingStatus(postId, "PROCESSING");

      const post = await postRepository.findById(postId);
      if (!post) {
        logger.warn(`Embedding job: post ${postId} not found, skipping`);
        return;
      }

      const vector = await embeddingService.generateEmbedding(post.text);
      const serialized = embeddingService.serialize(vector);

      await postRepository.updateEmbedding(postId, serialized, "DONE");
      await embeddingJobRepository.updateStatus(postId, "DONE");

      logger.debug(`Embedding generated for post ${postId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Embedding job failed for post ${postId}: ${message}`);
      await embeddingJobRepository.updateStatus(postId, "FAILED", message);
      await postRepository.updateEmbeddingStatus(postId, "FAILED");
    }
  }
}

export const embeddingQueue = new EmbeddingQueue();
