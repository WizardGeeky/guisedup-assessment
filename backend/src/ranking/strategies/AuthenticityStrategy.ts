import { Post } from "@prisma/client";
import { RankingStrategy, RankingContext } from "./types";

/**
 * Authenticity signal: posts that feel real rank higher than polished/filtered ones.
 *
 * The authenticityScore is pre-computed on post creation by the AuthenticityAnalyzer:
 * - Checks text for genuine markers (typos, lowercase, personal pronouns, no hashtag spam)
 * - Penalizes stock-photo-looking image URLs
 * - Rewards lower character count with more personal tone
 *
 * Score stored on the post (0.0 → 1.0). Here we just use it directly.
 *
 * Weight: 0.20 — third, because authenticity is the brand differentiator.
 */
export class AuthenticityStrategy implements RankingStrategy {
  name = "authenticity";
  weight = 0.20;

  score(post: Post, _context: RankingContext): number {
    return Math.max(0, Math.min(1, post.authenticityScore));
  }
}

/**
 * Computes an authenticity score for a post at creation time.
 * Higher score = more authentic.
 */
export function computeAuthenticityScore(text: string, imageUrl?: string | null): number {
  let score = 0.5;

  // Positive signals
  const hasPersonalPronouns = /\b(i|me|my|mine|myself|we|us|our)\b/i.test(text);
  const hasLowercase = text === text.toLowerCase();
  const wordCount = text.trim().split(/\s+/).length;
  const isReasonableLength = wordCount >= 3 && wordCount <= 150;
  const hasQuestionMark = text.includes("?");
  const hasEllipsis = text.includes("...");

  // Negative signals
  const hashtagCount = (text.match(/#\w+/g) ?? []).length;
  const hasExcessiveHashtags = hashtagCount > 5;
  const hasAllCaps = text.split(" ").filter((w) => w.length > 3 && w === w.toUpperCase()).length > 3;
  const hasStockKeywords = imageUrl
    ? /unsplash|shutterstock|gettyimages|stockphoto/i.test(imageUrl)
    : false;

  if (hasPersonalPronouns) score += 0.15;
  if (hasLowercase) score += 0.05;
  if (isReasonableLength) score += 0.10;
  if (hasQuestionMark) score += 0.05;
  if (hasEllipsis) score += 0.03;
  if (hasExcessiveHashtags) score -= 0.20;
  if (hasAllCaps) score -= 0.15;
  if (hasStockKeywords) score -= 0.15;
  if (!imageUrl) score += 0.07; // No image = raw text = more authentic

  return Math.max(0, Math.min(1, score));
}
