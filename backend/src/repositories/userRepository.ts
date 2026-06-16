import { User } from "@prisma/client";
import { prisma } from "../config/database";

export type CreateUserInput = {
  email: string;
  username: string;
  passwordHash: string;
  avatarUrl?: string;
  bio?: string;
};

export type PublicUser = Omit<User, "passwordHash">;

export const userRepository = {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  async findByUsername(username: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { username } });
  },

  async create(data: CreateUserInput): Promise<User> {
    return prisma.user.create({ data });
  },

  async findPublicById(id: string): Promise<PublicUser | null> {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
        passwordHash: false,
      },
    }) as Promise<PublicUser | null>;
  },

  async searchByUsername(query: string, excludeId: string, limit = 20): Promise<PublicUser[]> {
    return prisma.user.findMany({
      where: {
        username: { contains: query, mode: "insensitive" },
        NOT: { id: excludeId },
      },
      select: {
        id: true, email: true, username: true,
        avatarUrl: true, bio: true, createdAt: true, updatedAt: true,
        passwordHash: false,
      },
      take: limit,
      orderBy: { username: "asc" },
    }) as Promise<PublicUser[]>;
  },

  async update(id: string, data: Partial<Pick<User, "bio" | "avatarUrl">>): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  },

  async updatePasswordHash(email: string, passwordHash: string): Promise<User> {
    return prisma.user.update({ where: { email }, data: { passwordHash } });
  },
};
