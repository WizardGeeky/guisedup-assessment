import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { embeddingQueue } from "./jobs/embeddingQueue";

async function main(): Promise<void> {
  await connectDatabase();

  // Start background embedding worker
  embeddingQueue.startWorker();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await embeddingQueue.close();
      await disconnectDatabase();
      logger.info("Server shut down");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection:", reason);
    process.exit(1);
  });
}

main().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});
