# 🗄️ Database Design — Guised Up Real Connections Feed

> **Stack:** PostgreSQL 15+ · Prisma ORM 5.x · pgvector (production) · Node.js 20+
> **Last updated:** June 2026

---

## 1. Overview

The Guised Up database is designed around a single core principle: **ranking posts by genuine relationship depth**, not raw engagement metrics. This shapes every schema decision — from how interactions are stored (idempotent per type) to why relationship depth scores are pre-computed and cached.

| Attribute | Value |
|-----------|-------|
| Engine | PostgreSQL 15+ |
| ORM | Prisma 5.x (TypeScript-first) |
| Total Models | 9 |
| Vector search | JSON string (dev) → pgvector `vector(384)` (prod) |
| Embedding dimension | 384 (all-MiniLM-L6-v2 compatible) |
| Cascade strategy | `onDelete: Cascade` on all user-owned data |

### 9 Models at a Glance

| Model | Table | Purpose |
|-------|-------|---------|
| `User` | `users` | Core identity, auth, profile |
| `Post` | `posts` | Content with embedding + authenticity score |
| `Interaction` | `interactions` | VIEW / REPLY / REACTION (idempotent) |
| `UserRelationship` | `user_relationships` | Pre-computed depth score between users |
| `RefreshToken` | `refresh_tokens` | JWT refresh token rotation |
| `EmbeddingJob` | `embedding_jobs` | Async embedding pipeline tracking |
| `Comment` | `comments` | Threaded post comments |
| `Notification` | `notifications` | In-app notification inbox |
| `Message` | `messages` | Direct messages between users |

---

## 2. Entity-Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ POST : "authors"
    USER ||--o{ INTERACTION : "performs"
    USER ||--o{ COMMENT : "writes"
    USER ||--o{ NOTIFICATION : "receives (userId)"
    USER ||--o{ NOTIFICATION : "sends (fromUserId)"
    USER ||--o{ MESSAGE : "sends (fromUserId)"
    USER ||--o{ MESSAGE : "receives (toUserId)"
    USER ||--o{ USER_RELATIONSHIP : "source"
    USER ||--o{ USER_RELATIONSHIP : "target"
    USER ||--o{ REFRESH_TOKEN : "owns"
    POST ||--o{ INTERACTION : "receives"
    POST ||--o{ COMMENT : "has"
    POST ||--|| EMBEDDING_JOB : "has one job"
    POST ||--o{ NOTIFICATION : "mentioned in"

    USER {
        uuid id PK
        string email UK
        string username UK
        string password_hash
        string avatar_url "nullable"
        string bio "nullable"
        datetime created_at
        datetime updated_at
    }

    POST {
        uuid id PK
        uuid author_id FK
        text text
        string image_url "nullable"
        float authenticity_score "default 0.5"
        text embedding_vector "JSON float[], nullable"
        enum embedding_status "PENDING|PROCESSING|DONE|FAILED"
        int view_count "default 0"
        datetime created_at
        datetime updated_at
    }

    INTERACTION {
        uuid id PK
        uuid user_id FK
        uuid post_id FK
        enum type "VIEW|REPLY|REACTION"
        datetime created_at
    }

    USER_RELATIONSHIP {
        uuid id PK
        uuid source_user_id FK
        uuid target_user_id FK
        float depth_score "default 0.0"
        datetime created_at
        datetime updated_at
    }

    REFRESH_TOKEN {
        uuid id PK
        uuid user_id FK
        string token UK
        datetime expires_at
        datetime created_at
        boolean revoked "default false"
    }

    EMBEDDING_JOB {
        uuid id PK
        uuid post_id FK_UK
        enum status "QUEUED|PROCESSING|DONE|FAILED"
        int attempts "default 0"
        string error "nullable"
        datetime created_at
        datetime updated_at
    }

    COMMENT {
        uuid id PK
        uuid post_id FK
        uuid author_id FK
        text text
        datetime created_at
        datetime updated_at
    }

    NOTIFICATION {
        uuid id PK
        uuid user_id FK
        uuid from_user_id FK "nullable"
        enum type "COMMENT|REACTION|MENTION|MESSAGE"
        uuid post_id "nullable"
        uuid comment_id "nullable"
        string message
        boolean is_read "default false"
        datetime created_at
    }

    MESSAGE {
        uuid id PK
        uuid from_user_id FK
        uuid to_user_id FK
        text text
        boolean is_read "default false"
        datetime created_at
    }
```

---

## 3. Table Reference

### 3.1 🧑 `users`

**Purpose:** Core user identity table. Stores credentials, profile metadata, and links to all user-owned content. The `passwordHash` field stores bcrypt output (never raw passwords). Soft deletion is not used — cascading hard deletes propagate to all child records.

| Column | PG Type | Nullable | Default | Description |
|--------|---------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `email` | `varchar` | No | — | Unique login identifier |
| `username` | `varchar` | No | — | Public handle (3-30 chars, `[a-zA-Z0-9_]`) |
| `password_hash` | `varchar` | No | — | bcrypt hash of user password |
| `avatar_url` | `varchar` | Yes | `NULL` | Profile picture URL or data URI |
| `bio` | `varchar` | Yes | `NULL` | Short bio (max 200 chars) |
| `created_at` | `timestamptz` | No | `now()` | Account creation timestamp |
| `updated_at` | `timestamptz` | No | `now()` | Last profile update (auto-updated) |

**Constraints:**
- `UNIQUE(email)` — one account per email address
- `UNIQUE(username)` — globally unique display handle

**Indexes:**
| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_users_email` | `(email)` | Login lookup by email — O(log n) |
| `idx_users_username` | `(username)` | User search / profile lookup by handle |

---

### 3.2 📝 `posts`

**Purpose:** Content table. Each row represents a user's post with its text, optional image, and AI-derived metadata (authenticity score, embedding vector). The `embeddingStatus` tracks where each post is in the async vectorization pipeline.

| Column | PG Type | Nullable | Default | Description |
|--------|---------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `author_id` | `uuid` | No | — | FK → `users.id` |
| `text` | `text` | No | — | Post body (max 2000 chars enforced at app layer) |
| `image_url` | `varchar` | Yes | `NULL` | Attached image URL or data URI |
| `authenticity_score` | `float8` | No | `0.5` | Heuristic score `[0,1]` — higher = more authentic |
| `embedding_vector` | `text` | Yes | `NULL` | JSON-serialized `float[]` of 384 dimensions |
| `embedding_status` | `enum` | No | `PENDING` | `PENDING → PROCESSING → DONE / FAILED` |
| `view_count` | `int4` | No | `0` | Denormalized view counter (incremented on VIEW interaction) |
| `created_at` | `timestamptz` | No | `now()` | Post creation timestamp |
| `updated_at` | `timestamptz` | No | `now()` | Last edit timestamp |

**Constraints:**
- `FK author_id → users(id) ON DELETE CASCADE`

**Indexes:**
| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_posts_author_id` | `(author_id)` | Fetch all posts by a specific user |
| `idx_posts_created_at` | `(created_at DESC)` | Global chronological feed scan |
| `idx_posts_embedding_status` | `(embedding_status)` | Embedding worker polls `PENDING` rows |
| `idx_posts_authenticity_score` | `(authenticity_score DESC)` | Authenticity-sorted content discovery |
| `idx_posts_author_time` | `(author_id, created_at DESC)` | Fetch user's own timeline efficiently (composite) |

---

### 3.3 ❤️ `interactions`

**Purpose:** Records every VIEW, REPLY, and REACTION a user performs on a post. The triple-column unique constraint makes interactions **idempotent** — clicking "react" twice is a no-op at the database level.

| Column | PG Type | Nullable | Default | Description |
|--------|---------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | No | — | FK → `users.id` |
| `post_id` | `uuid` | No | — | FK → `posts.id` |
| `type` | `enum` | No | — | `VIEW`, `REPLY`, or `REACTION` |
| `created_at` | `timestamptz` | No | `now()` | When interaction occurred |

**Constraints:**
- `UNIQUE(user_id, post_id, type)` — idempotent; upsert-friendly
- `FK user_id → users(id) ON DELETE CASCADE`
- `FK post_id → posts(id) ON DELETE CASCADE`

**Indexes:**
| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_interactions_post_type` | `(post_id, type)` | Count interactions per post grouped by type (feed stats) |
| `idx_interactions_user_time` | `(user_id, created_at DESC)` | Relationship depth: recent activity between users |
| `idx_interactions_post_user` | `(post_id, user_id)` | Author-side query: who interacted with my posts |

---

### 3.4 🔗 `user_relationships`

**Purpose:** Stores the directional **relationship depth score** between pairs of users. The score is a composite metric derived from DM volume, replies, and reactions — computed asynchronously and cached here to avoid expensive JOINs in the feed hot path.

| Column | PG Type | Nullable | Default | Description |
|--------|---------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `source_user_id` | `uuid` | No | — | FK → `users.id` — the viewer / follower |
| `target_user_id` | `uuid` | No | — | FK → `users.id` — the content creator |
| `depth_score` | `float8` | No | `0.0` | Composite depth `[0, ∞)` — higher = closer relationship |
| `created_at` | `timestamptz` | No | `now()` | First interaction between this pair |
| `updated_at` | `timestamptz` | No | `now()` | Score last recalculated |

**Constraints:**
- `UNIQUE(source_user_id, target_user_id)` — one record per directional pair
- `FK source_user_id → users(id) ON DELETE CASCADE`
- `FK target_user_id → users(id) ON DELETE CASCADE`

**Indexes:**
| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_user_rel_source_depth` | `(source_user_id, depth_score DESC)` | Feed: "give me my closest contacts, strongest first" |

---

### 3.5 🔑 `refresh_tokens`

**Purpose:** Supports JWT refresh token rotation. Each successful refresh invalidates the old token (sets `revoked = true`) and issues a new one. Expired or revoked tokens are rejected at the application layer.

| Column | PG Type | Nullable | Default | Description |
|--------|---------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | No | — | FK → `users.id` |
| `token` | `varchar` | No | — | Opaque token string (UUID v4) |
| `expires_at` | `timestamptz` | No | — | Expiry (7 days from issuance) |
| `created_at` | `timestamptz` | No | `now()` | Issuance timestamp |
| `revoked` | `bool` | No | `false` | Set to `true` on rotation or logout |

**Constraints:**
- `UNIQUE(token)` — fast lookup, prevents replay
- `FK user_id → users(id) ON DELETE CASCADE`

**Indexes:**
| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_refresh_tokens_token` | `(token)` | O(1) token validation on every refresh request |
| `idx_refresh_tokens_user_id` | `(user_id)` | Revoke all tokens for a user on password change |

---

### 3.6 ⚙️ `embedding_jobs`

**Purpose:** Tracks the lifecycle of the async embedding pipeline for each post. A background worker polls `QUEUED` jobs, sets them to `PROCESSING`, computes the embedding, and writes the result back to `posts.embedding_vector`.

| Column | PG Type | Nullable | Default | Description |
|--------|---------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `post_id` | `uuid` | No | — | FK (unique) → `posts.id` |
| `status` | `enum` | No | `QUEUED` | `QUEUED → PROCESSING → DONE / FAILED` |
| `attempts` | `int4` | No | `0` | Retry count — max 3 before marking `FAILED` |
| `error` | `text` | Yes | `NULL` | Last error message on failure |
| `created_at` | `timestamptz` | No | `now()` | Job enqueued timestamp |
| `updated_at` | `timestamptz` | No | `now()` | Last status change |

**Constraints:**
- `UNIQUE(post_id)` — one embedding job per post
- `FK post_id → posts(id) ON DELETE CASCADE`

**Indexes:**
| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_embedding_jobs_status` | `(status)` | Worker polls `WHERE status = 'QUEUED'` |
| `idx_embedding_jobs_created_at` | `(created_at)` | Ordered processing, observability queries |

---

### 3.7 💬 `comments`

**Purpose:** Threaded comments on posts. Comments are ordered chronologically per post. Comment deletion is hard-delete; the post's comment list simply shortens.

| Column | PG Type | Nullable | Default | Description |
|--------|---------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `post_id` | `uuid` | No | — | FK → `posts.id` |
| `author_id` | `uuid` | No | — | FK → `users.id` |
| `text` | `text` | No | — | Comment body (max 500 chars, app-enforced) |
| `created_at` | `timestamptz` | No | `now()` | Posted timestamp |
| `updated_at` | `timestamptz` | No | `now()` | Last edited timestamp |

**Constraints:**
- `FK post_id → posts(id) ON DELETE CASCADE`
- `FK author_id → users(id) ON DELETE CASCADE`

**Indexes:**
| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_comments_post_time` | `(post_id, created_at DESC)` | Load all comments for a post, newest first |

---

### 3.8 🔔 `notifications`

**Purpose:** In-app notification inbox. A notification is created server-side whenever a user's content receives a COMMENT, REACTION, MENTION, or MESSAGE. The `fromUserId` is nullable to support system-generated notifications.

| Column | PG Type | Nullable | Default | Description |
|--------|---------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | No | — | FK → `users.id` — recipient |
| `from_user_id` | `uuid` | Yes | `NULL` | FK → `users.id` — sender (nullable for system) |
| `type` | `enum` | No | — | `COMMENT`, `REACTION`, `MENTION`, `MESSAGE` |
| `post_id` | `uuid` | Yes | `NULL` | Related post (if applicable) |
| `comment_id` | `uuid` | Yes | `NULL` | Related comment (if applicable) |
| `message` | `varchar` | No | — | Human-readable notification text |
| `is_read` | `bool` | No | `false` | Read status |
| `created_at` | `timestamptz` | No | `now()` | Delivery timestamp |

**Constraints:**
- `FK user_id → users(id) ON DELETE CASCADE`
- `FK from_user_id → users(id) ON DELETE SET NULL` — sender deletion preserves notification

**Indexes:**
| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_notifications_user_read_time` | `(user_id, is_read, created_at DESC)` | Notification inbox: unread-first, paginated |

---

### 3.9 💌 `messages`

**Purpose:** Direct messages between users. Messages are append-only (no edit/delete in v1). The `is_read` flag drives unread badge counts.

| Column | PG Type | Nullable | Default | Description |
|--------|---------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `from_user_id` | `uuid` | No | — | FK → `users.id` — sender |
| `to_user_id` | `uuid` | No | — | FK → `users.id` — recipient |
| `text` | `text` | No | — | Message body (max 2000 chars, app-enforced) |
| `is_read` | `bool` | No | `false` | Recipient has read this message |
| `created_at` | `timestamptz` | No | `now()` | Sent timestamp |

**Constraints:**
- `FK from_user_id → users(id) ON DELETE CASCADE`
- `FK to_user_id → users(id) ON DELETE CASCADE`

**Indexes:**
| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_messages_conversation` | `(from_user_id, to_user_id, created_at DESC)` | Load full conversation thread between two users |
| `idx_messages_unread` | `(to_user_id, is_read)` | Count unread messages per recipient |

---

## 4. Enum Definitions

| Enum | Values | Used In |
|------|--------|---------|
| `InteractionType` | `VIEW`, `REPLY`, `REACTION` | `interactions.type` |
| `EmbeddingStatus` | `PENDING`, `PROCESSING`, `DONE`, `FAILED` | `posts.embedding_status` |
| `EmbeddingJobStatus` | `QUEUED`, `PROCESSING`, `DONE`, `FAILED` | `embedding_jobs.status` |
| `NotificationType` | `COMMENT`, `REACTION`, `MENTION`, `MESSAGE` | `notifications.type` |

> **Note on `EmbeddingStatus` vs `EmbeddingJobStatus`:** Both enums cover the same state machine but serve different tables. `EmbeddingStatus` (`PENDING` initial state) lives on the `Post` and is the denormalized read-side status. `EmbeddingJobStatus` (`QUEUED` initial state) lives on the `EmbeddingJob` and is the authoritative worker-side state. The naming difference (`PENDING` vs `QUEUED`) was intentional to signal which layer each belongs to.

---

## 5. Index Strategy

### 5.1 Index Inventory

| Table | Index Name | Columns | Type |
|-------|-----------|---------|------|
| `users` | `idx_users_email` | `(email)` | B-Tree |
| `users` | `idx_users_username` | `(username)` | B-Tree |
| `posts` | `idx_posts_author_id` | `(author_id)` | B-Tree |
| `posts` | `idx_posts_created_at` | `(created_at DESC)` | B-Tree |
| `posts` | `idx_posts_embedding_status` | `(embedding_status)` | B-Tree |
| `posts` | `idx_posts_authenticity_score` | `(authenticity_score DESC)` | B-Tree |
| `posts` | `idx_posts_author_time` | `(author_id, created_at DESC)` | B-Tree (composite) |
| `interactions` | `idx_interactions_post_type` | `(post_id, type)` | B-Tree (composite) |
| `interactions` | `idx_interactions_user_time` | `(user_id, created_at DESC)` | B-Tree (composite) |
| `interactions` | `idx_interactions_post_user` | `(post_id, user_id)` | B-Tree (composite) |
| `user_relationships` | `idx_user_rel_source_depth` | `(source_user_id, depth_score DESC)` | B-Tree (composite) |
| `refresh_tokens` | `idx_refresh_tokens_token` | `(token)` | B-Tree |
| `refresh_tokens` | `idx_refresh_tokens_user_id` | `(user_id)` | B-Tree |
| `embedding_jobs` | `idx_embedding_jobs_status` | `(status)` | B-Tree |
| `embedding_jobs` | `idx_embedding_jobs_created_at` | `(created_at)` | B-Tree |
| `comments` | `idx_comments_post_time` | `(post_id, created_at DESC)` | B-Tree (composite) |
| `notifications` | `idx_notifications_user_read_time` | `(user_id, is_read, created_at DESC)` | B-Tree (composite) |
| `messages` | `idx_messages_conversation` | `(from_user_id, to_user_id, created_at DESC)` | B-Tree (composite) |
| `messages` | `idx_messages_unread` | `(to_user_id, is_read)` | B-Tree (composite) |

### 5.2 Query Pattern Analysis

**Login by email:**
```sql
-- Uses: idx_users_email
SELECT * FROM users WHERE email = 'alice@example.com';
-- Cost: O(log n) index scan
```

**User's own post timeline:**
```sql
-- Uses: idx_posts_author_time (composite covers both filter + sort)
SELECT * FROM posts WHERE author_id = $1 ORDER BY created_at DESC LIMIT 20;
```

**Feed candidate pool:**
```sql
-- Uses: idx_posts_created_at — global chronological scan, excludes viewer
SELECT * FROM posts WHERE author_id != $1 ORDER BY created_at DESC LIMIT 60;
```

**Interaction count per post:**
```sql
-- Uses: idx_interactions_post_type — covers WHERE + GROUP BY
SELECT type, COUNT(*) FROM interactions WHERE post_id = $1 GROUP BY type;
```

**Relationship depth lookup:**
```sql
-- Uses: idx_user_rel_source_depth — sorted by depth, viewer is first key
SELECT target_user_id, depth_score FROM user_relationships
WHERE source_user_id = $1 ORDER BY depth_score DESC;
```

**Unread notification inbox:**
```sql
-- Uses: idx_notifications_user_read_time — all three columns covered
SELECT * FROM notifications
WHERE user_id = $1 AND is_read = false
ORDER BY created_at DESC LIMIT 50;
```

**Embedding worker poll:**
```sql
-- Uses: idx_embedding_jobs_status
SELECT * FROM embedding_jobs WHERE status = 'QUEUED' ORDER BY created_at LIMIT 10;
```

**Token validation (refresh / logout):**
```sql
-- Uses: idx_refresh_tokens_token (unique index — hash lookup)
SELECT * FROM refresh_tokens WHERE token = $1 AND revoked = false;
```

**Vector search (production):**
```sql
-- Uses: HNSW index on posts.embedding_vec (pgvector extension)
SELECT id, 1 - (embedding_vec <=> $1::vector) AS score
FROM posts WHERE embedding_status = 'DONE'
ORDER BY embedding_vec <=> $1::vector LIMIT 10;
```

### 5.3 Composite Index Rationale

Composite indexes were chosen over single-column alternatives where **queries filter on one column and sort/filter on another simultaneously**. Adding both columns to one index eliminates a second lookup or an in-memory sort:

| Composite Index | Why not two single-column indexes? |
|----------------|-----------------------------------|
| `(author_id, created_at DESC)` | Single `author_id` index would require a separate sort; composite is index-only for this query pattern |
| `(post_id, type)` | Counting by type needs both columns — a two-index plan would require a bitmap AND, which is slower |
| `(user_id, created_at DESC)` | Relationship depth queries need recent interactions per user — covering both avoids a heap fetch for ordering |
| `(post_id, user_id)` | Author-side query: "who reacted to my posts" — composite serves as covering index |
| `(source_user_id, depth_score DESC)` | Feed ranking sorts by depth given a viewer — must filter and sort in one pass |
| `(user_id, is_read, created_at DESC)` | Notification inbox filters on recipient + read status, then sorts by time — three-column composite eliminates all heap access |
| `(from_user_id, to_user_id, created_at DESC)` | Conversation thread lookup: both participants must be specified before ordering |

---

## 6. Normalization & Denormalization Decisions

| Field | Normalized? | Decision | Reason |
|-------|-------------|----------|--------|
| `posts.view_count` | Denormalized | Incremented on each VIEW interaction | `O(1)` read via column vs `COUNT(*) WHERE type='VIEW'` on millions of rows |
| `posts.authenticity_score` | Denormalized | Computed at write time | Avoids recomputing a heuristic function on every feed load (score rarely changes) |
| `posts.embedding_vector` | Denormalized | Stored on `posts` not a separate table | Hot path: vector search needs embedding co-located with post metadata |
| `interactions` triple unique | Normalized | `UNIQUE(user_id, post_id, type)` | Idempotent interaction recording — double-click is safe at DB level |
| `user_relationships.depth_score` | Denormalized | Pre-computed relationship score | Avoids O(n×m) aggregation join in the feed hot path (computed async, updated on each interaction) |
| `notifications.message` | Denormalized | Human-readable text stored verbatim | Avoids rehydrating sender + event context on every notification load |
| `embedding_jobs` separate table | Normalized | `EmbeddingJob` is a separate entity from `Post` | Separates concerns: post content vs processing state; enables retry tracking without polluting `posts` |
| `refresh_tokens` separate table | Normalized | Not embedded in `users` | Supports multiple active sessions and granular revocation (revoke one device, not all) |

---

## 7. pgvector Production Setup

The development environment stores embeddings as a JSON-serialized `text` column. Production requires migrating to native `vector` type with an HNSW index for approximate nearest-neighbor (ANN) search at scale.

### 7.1 Enable Extension

```sql
-- Run once on the database (requires superuser)
CREATE EXTENSION IF NOT EXISTS vector;
```

### 7.2 Column Migration

```sql
-- Add native vector column alongside existing text column
ALTER TABLE posts ADD COLUMN embedding_vec vector(384);

-- Backfill from JSON text column
UPDATE posts
SET embedding_vec = embedding_vector::vector
WHERE embedding_vector IS NOT NULL AND embedding_status = 'DONE';

-- Drop text column after verification
ALTER TABLE posts DROP COLUMN embedding_vector;
```

### 7.3 HNSW Index for ANN Search

```sql
-- HNSW index — best for high-recall search at production latency (<5ms for 1M rows)
-- m=16: connections per layer (higher = more recall, more memory)
-- ef_construction=64: build-time search width (higher = better recall, slower build)
CREATE INDEX idx_posts_embedding_hnsw ON posts
USING hnsw (embedding_vec vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### 7.4 Search Query

```sql
-- Cosine similarity search using <=> operator (cosine distance — lower is more similar)
-- 1 - distance = similarity score [0, 1]
SELECT
  id,
  author_id,
  text,
  authenticity_score,
  created_at,
  1 - (embedding_vec <=> $1::vector) AS similarity_score
FROM posts
WHERE
  embedding_status = 'DONE'
  AND embedding_vec IS NOT NULL
ORDER BY embedding_vec <=> $1::vector
LIMIT 10;
```

### 7.5 Prisma Schema Update (production migration)

```prisma
// In schema.prisma — add pgvector extension support
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}

model Post {
  // ... existing fields ...
  embeddingVec  Unsupported("vector(384)")?  @map("embedding_vec")
}
```

---

## 8. Scaling Considerations

### 8.1 Current Scale (MVP)

The schema handles the following out of the box without modifications:

| Metric | Supported (single Postgres instance) |
|--------|--------------------------------------|
| Users | ~500K |
| Posts | ~5M |
| Interactions | ~50M (index-assisted `COUNT`) |
| Feed latency | <100ms (60 candidates, in-memory ranking) |
| Search latency | <50ms (HNSW ANN, 5M posts) |
| Concurrent users | ~2K (connection pooling via PgBouncer) |

### 8.2 Partitioning Plan

The `interactions` table will grow fastest (every view generates a row). At ~50M+ rows, range-partition by month:

```sql
-- Convert to partitioned table by created_at month
CREATE TABLE interactions (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  type interaction_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE interactions_2026_01 PARTITION OF interactions
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE interactions_2026_02 PARTITION OF interactions
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ... continue monthly
```

**Why `interactions` first?** It receives one row per user view, reply, or reaction. At 100K DAU with 5 interactions/day = 500K rows/day = ~180M rows/year.

### 8.3 Read Replica Strategy

Split traffic to reduce load on the primary:

| Query Type | Target | Reason |
|-----------|--------|--------|
| `POST /auth/login`, `POST /auth/register` | Primary | Auth writes must be strongly consistent |
| `GET /feed`, `GET /search` | Read Replica | High-volume, slightly-stale data acceptable |
| `GET /api/posts/:id` | Read Replica | Content reads — 1-2s replication lag acceptable |
| `POST /interactions`, `POST /comments` | Primary | Writes require immediate consistency |
| `GET /notifications` | Read Replica | Slight delay in notification visibility is acceptable |

Implementation via Prisma:

```typescript
// prisma/client.ts
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL }, // primary
  },
});

const readPrisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_REPLICA_URL }, // read replica
  },
});
```

### 8.4 Sharding Strategy (10B+ Scale)

At extreme scale, shard the `interactions` table by `user_id` hash:

```
Shard 0: user_id % 4 == 0  →  interactions_shard_0
Shard 1: user_id % 4 == 1  →  interactions_shard_1
Shard 2: user_id % 4 == 2  →  interactions_shard_2
Shard 3: user_id % 4 == 3  →  interactions_shard_3
```

**Why `user_id` hash?** The primary query pattern for relationship depth is "all interactions by viewer X" — a `user_id` hash shard key keeps this query on a single shard with no cross-shard scatter.

The `posts` table is sharded by `author_id` for the same reason: user timelines are always queried per-author, keeping data local.

---

## 9. Migration Strategy

### 9.1 How Prisma Migrations Work

Prisma maintains a `_prisma_migrations` table that records which migration files have been applied. Running `prisma migrate deploy` applies only unapended migrations in order.

```bash
# Development — creates migration files + applies them
npx prisma migrate dev --name add_embedding_vec_column

# Production — applies pending migrations only (no schema drift detection)
npx prisma migrate deploy

# Inspect pending migrations without applying
npx prisma migrate status
```

### 9.2 Safe Migration Checklist

Before every production migration:

- [ ] **Additive-only first**: Add nullable columns before making them required
- [ ] **Index concurrently**: For large tables, add indexes without locking
  ```sql
  -- Prisma doesn't support CONCURRENTLY — run manually before migration
  CREATE INDEX CONCURRENTLY idx_posts_new_col ON posts (new_col);
  ```
- [ ] **Backfill before constraint**: Populate data before adding NOT NULL
- [ ] **One migration per deploy**: Avoid bundling DDL + DML in one migration
- [ ] **Test rollback path**: Every migration should have a documented rollback SQL

### 9.3 Zero-Downtime Column Addition Pattern

```sql
-- Step 1: Add nullable column (no table lock)
ALTER TABLE posts ADD COLUMN new_col varchar;

-- Step 2: Backfill in batches (avoids full table lock)
DO $$
DECLARE batch_size INT := 10000;
DECLARE last_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  LOOP
    UPDATE posts SET new_col = 'default'
    WHERE id IN (
      SELECT id FROM posts WHERE new_col IS NULL AND id > last_id
      ORDER BY id LIMIT batch_size
    )
    RETURNING id INTO last_id;
    EXIT WHEN NOT FOUND;
    COMMIT;
  END LOOP;
END $$;

-- Step 3: Add NOT NULL constraint (fast if all rows populated)
ALTER TABLE posts ALTER COLUMN new_col SET NOT NULL;
```
