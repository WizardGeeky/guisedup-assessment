import { Server as SocketServer } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { JwtPayload } from "../middleware/auth";

let io: SocketServer | null = null;

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) return next(new Error("Unauthorized"));
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      socket.data.userId = payload.userId;
      socket.data.username = payload.username;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    void socket.join(`user:${userId}`);
    logger.info(`Socket connected: ${userId}`);

    socket.on("join-post", (postId: string) => {
      void socket.join(`post:${postId}`);
    });

    socket.on("leave-post", (postId: string) => {
      void socket.leave(`post:${postId}`);
    });

    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: ${userId}`);
    });
  });

  return io;
}

export function getIo(): SocketServer {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}
