# Technical Solution Document
## Feature: Real Connections Feed
**Author**: Eswar | **Date**: June 2026 | **Status**: Ready for Design Review

---

## Executive Summary

Guised Up's "Real Connections Feed" is a personalized content feed that ranks posts by authentic human connection signals — not engagement metrics. The system must feel fundamentally different from Instagram or Twitter: content surfaces because it's *genuinely relevant to you*, not because it went viral.

This document covers the full system design from database schema to deployment, with explicit reasoning for every technical decision.

---

## 1. Functional Requirements

| # | Requirement |
|---|-------------|
| F1 | Users can create posts with text and optional image URL |
| F2 | Every post gets a vector embedding for semantic search |
| F3 | `GET /api/feed` returns a personalized, ranked feed (20 per page, cursor-based) |
| F4 | `GET /api/search?q=` returns semantically relevant results (not keyword matches) |
| F5 | `POST /api/interactions` records VIEW, REPLY, or REACTION against a post |
| F6 | Feed ranking uses 4 signals: semantic similarity, relationship depth, authenticity, time decay |
| F7 | JWT + refresh token authentication |

---

## 2. Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NFR1 | Feed load latency | p99 < 300ms |
| NFR2 | Search latency | p99 < 500ms |
| NFR3 | Embedding generation | Async (< 5s background) |
| NFR4 | System scale | 10M users, 100M posts |
| NFR5 | Availability | 99.9% uptime |
| NFR6 | Auth security | JWT 15min TTL, refresh token rotation |

---

## 3. Assumptions & Constraints

- **Embedding model**: Mocked with a deterministic hash function. Production swap: OpenAI `text-embedding-3-small` (1536-dim) or `sentence-transformers/all-MiniLM-L6-v2` (384-dim, free, self-hosted).
- **No Redis/BullMQ dependency in dev**: Embedding queue uses DB-backed polling. Production uses BullMQ + Redis.
- **pgvector not available in dev**: Embeddings stored as JSON text. Production uses `pgvector` with HNSW indexes for ANN search.
- **Authenticity score is deterministic**: Computed at write time using heuristics. Future: ML classifier trained on human-labeled data.
- **No media upload service**: Image URL is a string. Production: pre-signed S3 URLs.
- **Cold start (new user)**: Falls back to chronological recent posts until the user has built interaction history.

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                   │
│                    React Native App (Expo 56)                               │
└─────────────────────────────┬──────────────────────────────────────────────┘
                              │ HTTPS / Bearer JWT
┌─────────────────────────────▼──────────────────────────────────────────────┐
│                           API GATEWAY                                       │
│                   Rate Limiter + Helmet + CORS                              │
└─────────────────────────────┬──────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────────────────┐
│                        EXPRESS API SERVER                                   │
│                                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │   Auth   │  │  Posts   │  │   Feed   │  │  Search  │                  │
│  │ Controller│ │Controller│  │Controller│  │Controller│                  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │
│       │             │             │              │                          │
│  ┌────▼─────┐  ┌────▼─────┐  ┌────▼──────────────▼──┐                    │
│  │  Auth    │  │  Post    │  │     Feed Service       │                   │
│  │ Service  │  │ Service  │  │  + Ranking Engine      │                   │
│  └────┬─────┘  └────┬─────┘  └────────────┬──────────┘                   │
│       │             │                      │                               │
│  ┌────▼─────────────▼──────────────────────▼──────────┐                   │
│  │                  REPOSITORY LAYER                    │                  │
│  │  userRepo | postRepo | interactionRepo | feedRepo   │                  │
│  └─────────────────────────┬────────────────────────── ┘                  │
│                             │                                               │
│  ┌──────────────────────────▼────────────────────────────┐                │
│  │              Background Job Queue (BullMQ/DB poll)     │                │
│  │              Embedding Worker (5s poll interval)       │                │
│  └──────────────────────────────────────────────────────┘                 │
└─────────────────────────────┬──────────────────────────────────────────────┘
                              │
          ┌───────────────────┴──────────────────────┐
          │                                           │
┌─────────▼──────────┐                   ┌───────────▼──────────┐
│   PostgreSQL        │                   │   Vector Index       │
│   (Primary Data)    │                   │   (pgvector/HNSW)    │
│                     │                   │   [same PG instance  │
│   users             │                   │    in production]    │
│   posts             │                   └──────────────────────┘
│   interactions      │
│   user_relationships│
│   refresh_tokens    │
│   embedding_jobs    │
└─────────────────────┘
```

---

## 5. Database Schema Design

### Tables & Relationships

```sql
users
  id (UUID PK)
  email (UNIQUE)
  username (UNIQUE)
  password_hash
  avatar_url
  bio
  created_at, updated_at

posts
  id (UUID PK)
  author_id (FK → users)
  text
  image_url
  authenticity_score FLOAT  -- computed at write time
  embedding_vector TEXT     -- JSON float[] | production: vector(384)
  embedding_status ENUM (PENDING, PROCESSING, DONE, FAILED)
  view_count INT            -- denormalized for O(1) read
  created_at, updated_at

interactions
  id (UUID PK)
  user_id (FK → users)
  post_id (FK → posts)
  type ENUM (VIEW, REPLY, REACTION)
  created_at
  UNIQUE (user_id, post_id, type)  -- idempotent interactions

user_relationships
  id (UUID PK)
  source_user_id (FK → users)
  target_user_id (FK → users)
  depth_score FLOAT         -- pre-computed, updated async
  UNIQUE (source_user_id, target_user_id)

refresh_tokens
  id (UUID PK)
  user_id (FK → users)
  token (UNIQUE)
  expires_at DATETIME
  revoked BOOLEAN

embedding_jobs
  id (UUID PK)
  post_id (UNIQUE FK → posts)
  status ENUM (QUEUED, PROCESSING, DONE, FAILED)
  attempts INT
  error TEXT
```

### Index Strategy

| Index | Table | Columns | Reason |
|-------|-------|---------|--------|
| idx_users_email | users | email | Login lookup |
| idx_users_username | users | username | Profile lookup |
| idx_posts_author_time | posts | (author_id, created_at DESC) | Feed candidate retrieval |
| idx_posts_embedding_status | posts | embedding_status | Queue polling |
| idx_posts_authenticity | posts | authenticity_score DESC | Ranking |
| idx_interactions_post_type | interactions | (post_id, type) | Count by type per post |
| idx_interactions_user_time | interactions | (user_id, created_at DESC) | Relationship depth |
| idx_relationships_source_depth | user_relationships | (source_user_id, depth_score DESC) | Feed author selection |
| pgvector HNSW | posts | embedding_vector | ANN search (production) |

### Normalization Decisions

- `view_count` is **denormalized** onto posts for O(1) read in D3 query. Trade-off: slight write amplification on view events. Justified because views are read much more often than written.
- Interaction counts are **NOT denormalized** for reply/reaction because they change less frequently and the GROUP BY query is fast with proper indexes.
- `depth_score` on `user_relationships` is a **pre-computed cache** updated by a background job, avoiding expensive joins in the feed hot path.

### Scale to 10M users / 100M posts

- **Partitioning**: Partition `interactions` by month (time-based range partitioning). Old partitions can be archived to cold storage.
- **Read replicas**: Feed queries are read-heavy. Route all GET /api/feed and GET /api/search to a read replica.
- **Sharding**: At 1B+ interactions, shard `interactions` by `user_id` hash. This co-locates a user's interactions for efficient relationship depth queries.
- **pgvector scaling**: At 100M posts, HNSW index fits in ~60GB RAM at 384-dim. Consider Qdrant or Pinecone for sharded vector search beyond that.

---

## 6. API Design

### Authentication Strategy

- **Access Token**: JWT, 15min TTL, signed with `JWT_SECRET`
- **Refresh Token**: JWT, 7-day TTL, persisted to DB (`refresh_tokens` table)
- **Rotation**: Every refresh call revokes the old refresh token and issues a new one (prevents replay attacks)
- **Revocation**: Logout marks refresh token as `revoked=true` in DB

```
Authorization: Bearer <access_token>
```

### Endpoints

#### POST /api/auth/register
```json
Request:  { "email": "...", "username": "...", "password": "..." }
Response: {
  "success": true,
  "data": {
    "user": { "id": "...", "email": "...", "username": "..." },
    "tokens": { "accessToken": "...", "refreshToken": "...", "expiresIn": "15m" }
  }
}
```

#### POST /api/auth/login
```
Same shape as register response.
```

#### POST /api/posts
```json
Request:  { "text": "...", "imageUrl": "https://..." }
Response: {
  "success": true,
  "data": {
    "post": { "id": "...", "text": "...", "authenticityScore": 0.72, "embeddingStatus": "PENDING", ... },
    "embeddingStatus": "queued"
  }
}
```

#### GET /api/feed?cursor=&limit=20
```json
Response: {
  "success": true,
  "data": [
    {
      "post": {
        "id": "...", "text": "...", "author": { "username": "...", "avatarUrl": null },
        "authenticityScore": 0.85, "createdAt": "..."
      },
      "scores": {
        "semantic": 0.72, "relationship": 0.65, "authenticity": 0.85, "timeDecay": 0.91,
        "final": 0.77
      }
    }
  ],
  "meta": {
    "hasMore": true,
    "nextCursor": "post-uuid-here"
  }
}
```

#### GET /api/search?q=funny travel stories
```json
Response: {
  "success": true,
  "data": [
    { "post": { ... }, "relevanceScore": 0.89 }
  ]
}
```

#### POST /api/interactions
```json
Request:  { "postId": "uuid", "type": "REACTION" }
Response: { "success": true, "data": { "id": "...", "userId": "...", "postId": "...", "type": "REACTION" } }
```

---

## 7. Feed Ranking Algorithm

### Plain English

Every post in the candidate set is scored across four dimensions. The final score is a weighted sum:

1. **Semantic Similarity (35%)**: How well does the post match what you actually care about? Computed as cosine similarity between the post's embedding and your "interest profile" (an average of embeddings from posts you've reacted to or replied to).

2. **Relationship Depth (30%)**: How much have you genuinely engaged with this author's content? A reply counts more than a view, but frequency of any interaction builds depth. Log-normalized to prevent one power user dominating. Cold-start score: 0.1 (small boost so new authors can still appear).

3. **Authenticity Score (20%)**: Is this a real human post or marketing content? Computed at write time using text heuristics: personal pronouns (+), lowercase (+), no hashtag spam (+), no stock image URL (+), reasonable length (+). Stored on the post for O(1) read during ranking.

4. **Time Decay (15%)**: Newer is better, but relevance matters more than recency. Exponential decay with a 48-hour half-life: a post that's 2 days old scores 0.5, a week-old post scores ~0.08. This prevents the feed from becoming a pure reverse-chronological stream.

### Pseudocode

```
function rankFeed(viewerUserId, candidatePosts):
  viewerEmbedding = averageOf(embeddings of posts viewer reacted to)
  depthMap = {authorId: interactionCount} for all candidate authors
  maxDepth = max(depthMap.values())

  for each post in candidatePosts:
    semantic    = cosineSimilarity(viewerEmbedding, post.embedding)
    relationship = logNormalize(depthMap[post.authorId], maxDepth)
    authenticity = post.authenticityScore  // pre-computed
    timeDecay   = exp(-0.0144 * hoursOld(post))

    post.finalScore = (0.35 × semantic)
                    + (0.30 × relationship)
                    + (0.20 × authenticity)
                    + (0.15 × timeDecay)

  return candidatePosts.sortBy(finalScore, descending)
```

### Design Decisions

- **Strategy Pattern** for ranking strategies: each dimension is an independent class implementing `RankingStrategy`. Adding a new signal (e.g., "topic freshness") requires zero changes to core engine logic.
- **No engagement metrics**: Explicitly excluded. No like counts, share counts, or comment counts in the ranking formula. This is the core product differentiator.
- **Candidate selection first**: Fetch 3× more posts than page size, re-rank, then paginate. This prevents the top-ranked posts from always being the same few.
- **Log normalization for depth**: Prevents a viewer who's obsessively interacted with one author from seeing only that author's content.

---

## 8. Vector Embeddings Architecture

### Why pgvector?

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| pgvector | Same DB, no extra infra, ACID consistency | Slower than dedicated vector DBs at 10M+ | ✅ **Chosen** for initial scale |
| Pinecone | Managed, fast ANN at scale | Vendor lock-in, extra latency hop | Upgrade path at 50M+ posts |
| Qdrant | Open-source, high performance | Extra infra to maintain | Upgrade path if self-hosting |
| Chroma | Simple, good for prototyping | Not production-ready for 100M scale | Dev/test only |

### Embedding Pipeline

```
POST /api/posts
  │
  ├── 1. Compute authenticityScore (sync, <1ms)
  │
  ├── 2. Save post to DB (embeddingStatus: PENDING)
  │
  ├── 3. Create EmbeddingJob record in DB
  │
  └── 4. Signal queue (fire-and-forget)
         │
         └── Background Worker (polls every 5s)
               │
               ├── 5. Generate embedding via model API
               │        (mock: deterministic hash | prod: sentence-transformers)
               │
               ├── 6. Store embedding in posts.embedding_vector
               │
               └── 7. Update embeddingStatus: DONE
```

### Production Embedding Model

```python
# sentence-transformers/all-MiniLM-L6-v2 — MIT license, 384-dim, runs on CPU
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('all-MiniLM-L6-v2')
embedding = model.encode(post_text).tolist()

# Or OpenAI text-embedding-3-small — 1536-dim, higher quality, costs $0.02/1M tokens
response = openai.embeddings.create(model="text-embedding-3-small", input=post_text)
embedding = response.data[0].embedding
```

### pgvector Production Schema Change

```sql
-- In production migration:
ALTER TABLE posts ADD COLUMN embedding_vector vector(384);
CREATE INDEX idx_posts_embedding_hnsw ON posts USING hnsw (embedding_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Search query:
SELECT id, 1 - (embedding_vector <=> $1::vector) AS score
FROM posts
WHERE embedding_status = 'DONE'
ORDER BY embedding_vector <=> $1::vector
LIMIT 10;
```

---

## 9. Background Job Processing

### Current Implementation (Dev)

In-process queue with DB-backed persistence. The `embedding_jobs` table acts as a durable queue:
- If the process crashes, jobs remain in QUEUED state and are retried on restart
- Max 3 retry attempts (tracked in `attempts` column)
- FAILED jobs are kept for monitoring and manual requeue

### Production Path (BullMQ + Redis)

```typescript
// Swap: replace EmbeddingQueue class with:
import { Queue, Worker } from 'bullmq';
const queue = new Queue('embeddings', { connection: redis });
const worker = new Worker('embeddings', async (job) => {
  await processEmbedding(job.data.postId);
}, { connection: redis, concurrency: 5 });
```

Benefits: Dead letter queue, job progress tracking, distributed workers, rate limiting per model API.

---

## 10. Caching Strategy

### What to Cache

| Data | TTL | Strategy | Rationale |
|------|-----|----------|-----------|
| User session profile | 5min | Redis key-value | Avoid DB hit on every authenticated request |
| Feed candidates for viewer | 30s | Redis key-value | Hot path, acceptable staleness |
| Viewer interest embedding | 5min | Redis key-value | Expensive to compute, changes slowly |
| Search results for query | 60s | Redis key-value | Same query by many users is common |

### Cache Invalidation

- Feed cache invalidated when the viewer creates an interaction
- User embedding cache invalidated when viewer's interaction count changes by >5
- No cache for posts themselves (they're read directly from DB with indexes)

---

## 11. Security Considerations

| Threat | Mitigation |
|--------|------------|
| JWT theft | Short 15min TTL, refresh token rotation, HTTPS only |
| Refresh token replay | Revoked immediately after use (token rotation) |
| SQL injection | Prisma ORM parameterized queries throughout |
| XSS | Helmet.js sets Content-Security-Policy headers |
| Rate limiting | 200 req/15min per IP on all /api/* routes |
| Password brute force | bcrypt with 12 rounds + rate limiting on login |
| CORS | Explicit origin allowlist (not wildcard in production) |
| Input validation | Zod schemas on all request bodies and query params |

---

## 12. Testing Strategy

### Unit Tests (Jest)
- `FeedRankingEngine`: rankings order, score bounds (0-1), strategy isolation
- `AuthenticityStrategy`: personal text vs marketing text scoring
- `TimeDecayStrategy`: half-life accuracy, boundary conditions
- `RelationshipDepthStrategy`: cold-start score, log normalization behavior
- `EmbeddingService`: determinism, dimension, cosine similarity correctness

### Integration Tests (supertest)
- `POST /api/posts`: 201 on valid, 422 on empty text, 401 without auth
- `GET /api/feed`: pagination shape, empty state
- `GET /api/search`: requires q param, returns ranked results
- `POST /api/auth/register`: conflict on duplicate email/username

### What's NOT tested here
- End-to-end DB integration (would require test DB setup)
- Embedding quality (requires real embedding model)
- Feed ranking accuracy (would require labeled evaluation dataset)

---

## 13. Monitoring & Logging

### Structured Logging (Winston)
```json
{ "level": "info", "message": "POST /api/posts 201 47ms", "timestamp": "2026-06-15T..." }
{ "level": "error", "message": "Embedding job failed", "postId": "...", "stack": "..." }
```

### Key Metrics to Track (Production)
- Feed load p50/p99 latency
- Embedding job queue depth
- Embedding failure rate
- Feed click-through rate (are people actually engaging with what they see?)
- Authenticity score distribution (are we correctly identifying genuine posts?)

---

## 14. Deployment Architecture

```
┌─────────────────────────────────┐
│         Load Balancer           │
│         (AWS ALB / Nginx)       │
└──────────────┬──────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼────┐          ┌─────▼──┐
│ API    │          │  API   │
│Server 1│          │Server 2│  (auto-scaled)
└───┬────┘          └─────┬──┘
    │                     │
    └──────────┬──────────┘
               │
┌──────────────▼─────────────────┐
│        PostgreSQL Primary       │
│   (RDS or self-hosted)         │
└──────────────┬─────────────────┘
               │  Streaming replication
┌──────────────▼─────────────────┐
│      PostgreSQL Read Replica   │
│   (feed reads, search reads)   │
└────────────────────────────────┘
```

### Docker (dev)
```yaml
services:
  api: { build: ./backend, ports: ["3000:3000"] }
  postgres: { image: "pgvector/pgvector:pg16", environment: [...] }
  redis: { image: "redis:7-alpine" }  # for production BullMQ
```

---

## 15. Trade-offs & Decisions

| Decision | Chosen | Alternative | Why |
|----------|--------|-------------|-----|
| Vector storage | JSON text (dev) → pgvector (prod) | Pinecone from day 1 | Minimize infra complexity for MVP. pgvector handles 10M posts comfortably |
| Embedding model | Mock hash (dev) → sentence-transformers | OpenAI API | Cost control. sentence-transformers is free, runs on CPU, good quality |
| Job queue | DB-backed poll (dev) → BullMQ (prod) | Immediate sync | Embedding is slow (100-500ms). Never block HTTP request |
| Pagination | Cursor-based | Offset/page | Offset pagination has n+1 problem at scale; cursor is O(1) regardless of page depth |
| Auth | JWT + refresh token rotation | Sessions | Stateless JWT works with multiple API server instances without session affinity |
| Ranking | Weighted score | ML ranker | Interpretable, debuggable, fast. ML ranker is the future upgrade path |
| Authenticity | Heuristics | ML classifier | ML needs labeled training data we don't have yet. Heuristics are good enough for v1 |

---

## 16. AI Tool Usage

This project was built using **Claude Code (claude-sonnet-4-6)** as the primary AI coding assistant.

### How AI was used:
1. **Architecture design**: Claude helped reason through the ranking algorithm weights, strategy pattern structure, and database index decisions.
2. **Code generation**: All TypeScript files were generated with Claude, then reviewed and adjusted. Speed gain: ~5× faster than writing from scratch.
3. **SQL query optimization**: Claude identified that `NOT EXISTS` is generally faster than `LEFT JOIN + HAVING COUNT = 0` for the D3 query and provided both alternatives.
4. **Test case design**: Claude generated the edge cases for the ranking tests (48h half-life verification, cold-start score, log normalization behavior).
5. **Trade-off analysis**: Claude helped document and reason through the pgvector vs Pinecone decision and the mock vs real embedding tradeoff.

### What was NOT delegated to AI:
- Product understanding and ranking weight decisions (35% semantic, etc.)
- Choice of stack (Node.js vs Laravel vs Python — chose Node for type safety across the codebase)
- Index design rationale (required understanding the actual query access patterns)

---

## 17. Future Enhancements

1. **Real-time feed updates**: WebSocket push when highly-relevant new posts arrive
2. **ML ranking model**: Replace weighted formula with a learned model (collaborative filtering or LTR)
3. **Authenticity ML**: Train a classifier on human-labeled authentic vs inauthentic posts
4. **Interest graph**: Build an explicit interest graph from interaction patterns, used in semantic matching
5. **Post aging curve**: Different decay rates for different content types (text vs image)
6. **Privacy controls**: "Connection depth" preference — let users choose how much relationship signals matter to them
7. **Spam detection job**: Run D4 query on a cron every hour, auto-flag accounts for review
