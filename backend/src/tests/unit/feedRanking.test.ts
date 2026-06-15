import { FeedRankingEngine } from "../../ranking/FeedRankingEngine";
import { SemanticSimilarityStrategy } from "../../ranking/strategies/SemanticSimilarityStrategy";
import { RelationshipDepthStrategy } from "../../ranking/strategies/RelationshipDepthStrategy";
import { AuthenticityStrategy } from "../../ranking/strategies/AuthenticityStrategy";
import { TimeDecayStrategy } from "../../ranking/strategies/TimeDecayStrategy";
import { computeAuthenticityScore } from "../../ranking/strategies/AuthenticityStrategy";
import { RankingContext } from "../../ranking/strategies/types";
import { Post } from "@prisma/client";

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: "test-post-id",
    authorId: "test-author-id",
    text: "This is a test post about travel",
    imageUrl: null,
    authenticityScore: 0.7,
    embeddingVector: null,
    embeddingStatus: "PENDING",
    viewCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeContext(overrides: Partial<RankingContext> = {}): RankingContext {
  return {
    viewerUserId: "viewer-id",
    viewerEmbedding: [],
    relationshipDepths: new Map([["test-author-id", 5]]),
    maxDepthScore: 10,
    ...overrides,
  };
}

describe("FeedRankingEngine", () => {
  let engine: FeedRankingEngine;

  beforeEach(() => {
    engine = new FeedRankingEngine();
  });

  describe("rank()", () => {
    it("returns posts sorted by final score descending", () => {
      const recentPost = makePost({ id: "recent", createdAt: new Date() });
      const oldPost = makePost({
        id: "old",
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        authenticityScore: 0.1,
      });

      const context = makeContext();
      const ranked = engine.rank(
        [oldPost, recentPost].map((p) => ({
          ...p,
          author: { id: p.authorId, username: "user", avatarUrl: null },
        })),
        context,
      );

      expect(ranked.length).toBe(2);
      expect(ranked[0]!.scores.final).toBeGreaterThanOrEqual(ranked[1]!.scores.final);
    });

    it("recent post ranks higher than identical week-old post", () => {
      const newPost = makePost({ id: "new", createdAt: new Date() });
      const oldPost = makePost({
        id: "old",
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      });

      const context = makeContext();
      const ranked = engine.rank(
        [oldPost, newPost].map((p) => ({
          ...p,
          author: { id: p.authorId, username: "user", avatarUrl: null },
        })),
        context,
      );

      const newRanked = ranked.find((r) => r.post.id === "new")!;
      const oldRanked = ranked.find((r) => r.post.id === "old")!;

      expect(newRanked.scores.timeDecay).toBeGreaterThan(oldRanked.scores.timeDecay);
    });

    it("scores are all between 0 and 1", () => {
      const posts = [
        makePost({ id: "p1", authenticityScore: 0.9 }),
        makePost({ id: "p2", authenticityScore: 0.2 }),
      ];
      const context = makeContext();
      const ranked = engine.rank(
        posts.map((p) => ({
          ...p,
          author: { id: p.authorId, username: "user", avatarUrl: null },
        })),
        context,
      );

      for (const r of ranked) {
        expect(r.scores.final).toBeGreaterThanOrEqual(0);
        expect(r.scores.final).toBeLessThanOrEqual(1);
        expect(r.scores.authenticity).toBeGreaterThanOrEqual(0);
        expect(r.scores.authenticity).toBeLessThanOrEqual(1);
        expect(r.scores.timeDecay).toBeGreaterThanOrEqual(0);
        expect(r.scores.timeDecay).toBeLessThanOrEqual(1);
      }
    });
  });
});

describe("AuthenticityStrategy", () => {
  const strategy = new AuthenticityStrategy();
  const context = makeContext();

  it("scores higher for personal pronoun text", () => {
    const personal = makePost({ text: "i just got back from the most amazing trip. im so happy" });
    const marketing = makePost({ text: "BEST PRODUCT EVER!!! BUY NOW!!! #sale #discount #promo #deal #shop" });

    const personalScore = strategy.score(personal, context);
    const marketingScore = strategy.score(marketing, context);

    expect(personalScore).toBeGreaterThan(marketingScore);
  });
});

describe("TimeDecayStrategy", () => {
  const strategy = new TimeDecayStrategy();
  const context = makeContext();

  it("48h old post scores approximately 0.5", () => {
    const post = makePost({
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    });
    const score = strategy.score(post, context);
    expect(score).toBeGreaterThan(0.45);
    expect(score).toBeLessThan(0.55);
  });

  it("brand new post scores close to 1", () => {
    const post = makePost({ createdAt: new Date() });
    const score = strategy.score(post, context);
    expect(score).toBeGreaterThan(0.95);
  });
});

describe("computeAuthenticityScore", () => {
  it("scores plain personal text higher than hashtag-spam", () => {
    const personal = computeAuthenticityScore("i had the best day today, met so many cool people");
    const spam = computeAuthenticityScore("CHECK THIS OUT!!! #trending #viral #follow #like #share #repost");
    expect(personal).toBeGreaterThan(spam);
  });

  it("returns a score between 0 and 1", () => {
    const score = computeAuthenticityScore("some random text here");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("no-image post scores higher than stock photo post", () => {
    const noImage = computeAuthenticityScore("had a great day", undefined);
    const stockPhoto = computeAuthenticityScore("had a great day", "https://unsplash.com/photo/xyz");
    expect(noImage).toBeGreaterThan(stockPhoto);
  });
});

describe("RelationshipDepthStrategy", () => {
  const strategy = new RelationshipDepthStrategy();

  it("returns 0.1 (cold start boost) when no relationship exists", () => {
    const post = makePost({ authorId: "unknown-author" });
    const context = makeContext({ relationshipDepths: new Map() });
    expect(strategy.score(post, context)).toBe(0.1);
  });

  it("scores higher for deeper relationships", () => {
    const post = makePost({ authorId: "author" });
    const deepContext = makeContext({
      relationshipDepths: new Map([["author", 100]]),
      maxDepthScore: 100,
    });
    const shallowContext = makeContext({
      relationshipDepths: new Map([["author", 2]]),
      maxDepthScore: 100,
    });

    const deepScore = strategy.score(post, deepContext);
    const shallowScore = strategy.score(post, shallowContext);

    expect(deepScore).toBeGreaterThan(shallowScore);
  });
});
