import { Response } from "express";

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  details?: unknown;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: PaginationMeta,
  message?: string,
): Response {
  const body: ApiSuccess<T> = { success: true, data };
  if (meta) body.meta = meta;
  if (message) body.message = message;
  return res.status(statusCode).json(body);
}

export function sendCreated<T>(res: Response, data: T, message?: string): Response {
  return sendSuccess(res, data, 201, undefined, message);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  details?: unknown,
): Response {
  const body: ApiError = { success: false, error: message };
  if (details) body.details = details;
  return res.status(statusCode).json(body);
}
