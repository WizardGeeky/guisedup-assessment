import { RefreshToken } from "@prisma/client";
import { prisma } from "../config/database";

export const refreshTokenRepository = {
  async create(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<RefreshToken> {
    return prisma.refreshToken.create({
      data: { userId, token, expiresAt },
    });
  },

  async findByToken(token: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findUnique({ where: { token } });
  },

  async revoke(token: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { token },
      data: { revoked: true },
    });
  },

  async revokeAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  },

  async deleteExpired(): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  },
};
