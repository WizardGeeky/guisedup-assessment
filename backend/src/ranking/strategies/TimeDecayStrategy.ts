import { Post } from "@prisma/client";
import { RankingStrategy, RankingContext } from "./types";

/**
 * Time decay: newer posts score higher, but decay is gradual — not a hard cutoff.
 *
 * Uses an exponential decay function:
 *   score = e^(-λ * hoursElapsed)
 *
 * Half-life is set to 48 hours (λ = ln(2) / 48 ≈ 0.0144).
 * At 48h: score ≈ 0.50
 * At 7 days: score ≈ 0.08
 * At 30 days: score ≈ 0.0001
 *
 * Weight: 0.15 — lowest because relevance and relationship matter more than recency.
 * This prevents the feed from becoming a pure chronological stream.
 */
export class TimeDecayStrategy implements RankingStrategy {
  name = "timeDecay";
  weight = 0.15;

  private readonly halfLifeHours = 48;
  private readonly lambda = Math.LN2 / this.halfLifeHours;

  score(post: Post, _context: RankingContext): number {
    const ageMs = Date.now() - post.createdAt.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    const decayScore = Math.exp(-this.lambda * ageHours);
    return Math.max(0, Math.min(1, decayScore));
  }
}
