/**
 * Integration tests for the Posts API.
 * These tests use the real Express app with a mocked Prisma client.
 */
import request from "supertest";
import { createApp } from "../../app";
import { Application } from "express";

// Mock the database so tests don't need a real PostgreSQL instance
jest.mock("../../config/database", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    post: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    embeddingJob: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    interaction: {
      upsert: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  },
  connectDatabase: jest.fn(),
  disconnectDatabase: jest.fn(),
}));

// Mock the embedding queue to prevent background jobs from running
jest.mock("../../jobs/embeddingQueue", () => ({
  embeddingQueue: {
    enqueue: jest.fn(),
    startWorker: jest.fn(),
    close: jest.fn(),
  },
}));

import { prisma } from "../../config/database";
import jwt from "jsonwebtoken";

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

function makeAuthToken(userId = "test-user-id"): string {
  return `Bearer ${jwt.sign(
    { userId, email: "test@example.com", username: "testuser" },
    process.env["JWT_SECRET"] ?? "change-me-in-production-must-be-32-chars-min",
    { expiresIn: "1h" },
  )}`;
}

describe("POST /api/posts", () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a post and returns 201", async () => {
    const mockPost = {
      id: "post-id-1",
      authorId: "test-user-id",
      text: "i had the most amazing morning walk today",
      imageUrl: null,
      authenticityScore: 0.7,
      embeddingVector: null,
      embeddingStatus: "PENDING",
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      author: { id: "test-user-id", username: "testuser", avatarUrl: null },
      _count: { interactions: 0 },
    };

    (mockPrisma.post.create as jest.Mock).mockResolvedValue(mockPost);
    (mockPrisma.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
    (mockPrisma.embeddingJob.create as jest.Mock).mockResolvedValue({ id: "job-1", postId: "post-id-1", status: "QUEUED", attempts: 0, error: null, createdAt: new Date(), updatedAt: new Date() });

    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", makeAuthToken())
      .send({ text: "i had the most amazing morning walk today" });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.post.text).toBe("i had the most amazing morning walk today");
    expect(response.body.data.embeddingStatus).toBe("queued");
  });

  it("returns 422 for empty text", async () => {
    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", makeAuthToken())
      .send({ text: "" });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it("returns 401 without auth token", async () => {
    const response = await request(app)
      .post("/api/posts")
      .send({ text: "a valid post" });

    expect(response.status).toBe(401);
  });

  it("validates imageUrl is a valid URL", async () => {
    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", makeAuthToken())
      .send({ text: "a valid post", imageUrl: "not-a-url" });

    expect(response.status).toBe(422);
  });

  it("accepts posts with valid imageUrl", async () => {
    const mockPost = {
      id: "post-id-2",
      authorId: "test-user-id",
      text: "camping in the mountains",
      imageUrl: "https://example.com/photo.jpg",
      authenticityScore: 0.6,
      embeddingVector: null,
      embeddingStatus: "PENDING",
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      author: { id: "test-user-id", username: "testuser", avatarUrl: null },
      _count: { interactions: 0 },
    };

    (mockPrisma.post.create as jest.Mock).mockResolvedValue(mockPost);
    (mockPrisma.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
    (mockPrisma.embeddingJob.create as jest.Mock).mockResolvedValue({ id: "job-2", postId: "post-id-2", status: "QUEUED", attempts: 0, error: null, createdAt: new Date(), updatedAt: new Date() });

    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", makeAuthToken())
      .send({ text: "camping in the mountains", imageUrl: "https://example.com/photo.jpg" });

    expect(response.status).toBe(201);
    expect(response.body.data.post.imageUrl).toBe("https://example.com/photo.jpg");
  });
});

describe("GET /api/feed", () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  it("returns 401 without auth token", async () => {
    const response = await request(app).get("/api/feed");
    expect(response.status).toBe(401);
  });

  it("returns paginated feed for authenticated user", async () => {
    (mockPrisma.interaction.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.post.findMany as jest.Mock).mockResolvedValue([]);

    const response = await request(app)
      .get("/api/feed")
      .set("Authorization", makeAuthToken());

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});

describe("GET /api/search", () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  it("returns 400 without q parameter", async () => {
    const response = await request(app)
      .get("/api/search")
      .set("Authorization", makeAuthToken());

    expect(response.status).toBe(422);
  });

  it("returns search results for valid query", async () => {
    (mockPrisma.post.findMany as jest.Mock).mockResolvedValue([]);

    const response = await request(app)
      .get("/api/search?q=travel stories")
      .set("Authorization", makeAuthToken());

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
