import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";
import { sendError } from "../utils/apiResponse";

export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error(`${req.method} ${req.path} — ${err.message}`, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode);
    return;
  }

  // Prisma errors
  if (err.constructor.name === "PrismaClientKnownRequestError") {
    const prismaErr = err as any;
    if (prismaErr.code === "P2002") {
      sendError(res, "A record with this value already exists", 409);
      return;
    }
    if (prismaErr.code === "P2025") {
      sendError(res, "Record not found", 404);
      return;
    }
  }

  // Unhandled operational error
  sendError(
    res,
    process.env["NODE_ENV"] === "production" ? "Internal server error" : err.message,
    500,
  );
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Route ${req.method} ${req.path} not found`, 404);
}
