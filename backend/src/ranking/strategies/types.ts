import { Post } from "@prisma/client";

export interface RankingContext {
  viewerUserId: string;
  viewerEmbedding: number[];
  relationshipDepths: Map<string, number>;
  // Max depth across all authors (for normalization)
  maxDepthScore: number;
}

export interface RankedPost {
  post: Post & {
    author: { id: string; username: string; avatarUrl: string | null };
    _count?: { interactions: number };
  };
  scores: {
    semantic: number;
    relationship: number;
    authenticity: number;
    timeDecay: number;
    final: number;
  };
}

export interface RankingStrategy {
  name: string;
  weight: number;
  score(post: Post, context: RankingContext): number;
}
