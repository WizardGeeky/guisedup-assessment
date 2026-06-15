import { env } from "../config/env";
import { logger } from "../utils/logger";

export type EmbeddingVector = number[];

/**
 * Mock embedding provider using a deterministic hash-based approach.
 *
 * Production swap: replace `generateEmbedding` body with:
 *   const response = await openai.embeddings.create({ model: "text-embedding-3-small", input: text });
 *   return response.data[0].embedding;
 *
 * Or with sentence-transformers via Python microservice:
 *   const res = await fetch(`${PYTHON_SERVICE_URL}/embed`, { method: "POST", body: JSON.stringify({ text }) });
 *   return (await res.json()).embedding;
 */
export class EmbeddingService {
  readonly dimension: number;

  constructor() {
    this.dimension = env.EMBEDDING_DIMENSION;
  }

  async generateEmbedding(text: string): Promise<EmbeddingVector> {
    // Deterministic mock: hash the text into a float vector
    // In production, call OpenAI text-embedding-3-small or sentence-transformers
    logger.debug(`Generating embedding for text (length=${text.length})`);
    return this.deterministicHash(text, this.dimension);
  }

  serialize(vector: EmbeddingVector): string {
    return JSON.stringify(vector);
  }

  deserialize(raw: string): EmbeddingVector {
    return JSON.parse(raw) as number[];
  }

  /**
   * Cosine similarity between two unit vectors.
   * Returns a score in [-1, 1], normalized to [0, 1] for ranking.
   */
  cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const ai = a[i] ?? 0;
      const bi = b[i] ?? 0;
      dotProduct += ai * bi;
      normA += ai * ai;
      normB += bi * bi;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    // Map [-1, 1] → [0, 1]
    return (dotProduct / denominator + 1) / 2;
  }

  /**
   * Deterministic hash-based embedding for mocking.
   * Same input always produces the same output — safe for testing.
   */
  private deterministicHash(text: string, dimension: number): EmbeddingVector {
    const normalized = text.toLowerCase().trim();
    const vector: number[] = new Array(dimension).fill(0) as number[];

    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      const idx = (i * 31 + charCode) % dimension;
      vector[idx] = (vector[idx]! + Math.sin(charCode * (i + 1) * 0.1)) / 2;
    }

    // L2 normalize so cosine similarity works correctly
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return norm === 0 ? vector : vector.map((v) => v / norm);
  }
}

export const embeddingService = new EmbeddingService();
