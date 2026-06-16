import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { globalErrorHandler, notFoundHandler } from "./middleware/errorHandler";
import { router } from "./routes";
import { swaggerSpec, swaggerUiOptions } from "./config/swagger";

export function createApp(): express.Application {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );

  // Rate limiting — prevents abuse
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "Too many requests, please try again later" },
  });
  app.use("/api/", limiter);

  // Body parsing
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(
    morgan("combined", {
      stream: { write: (msg: string) => logger.http(msg.trim()) },
    }),
  );

  // Health check (outside versioned routes)
  app.get("/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok", timestamp: new Date().toISOString() } });
  });

  // Swagger UI — interactive API documentation
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
  app.get("/api/docs.json", (_req, res) => { res.json(swaggerSpec); });

  // API routes
  app.use("/api", router);

  // 404 handler (must come after routes)
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(globalErrorHandler);

  return app;
}
