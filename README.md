# Guised Up — Real Connections Feed

**Full-Stack Developer Assessment Submission**

> A social platform where content surfaces because it's genuinely relevant to you — not because it went viral.

---

## Assessment Checklist

| Part | Requirement | Status |
|------|-------------|--------|
| **A** | Technical Solution Document (`/docs/TSD.md`) | ✅ |
| **B** | `POST /api/posts` — create post | ✅ |
| **B** | `GET /api/feed` — personalized ranked feed | ✅ |
| **B** | `GET /api/search?q=` — semantic search | ✅ |
| **B** | `POST /api/interactions` — log view/reply/reaction | ✅ |
| **B** | JWT auth (register, login, refresh, logout) | ✅ |
| **B** | Full CRUD on posts + comments | ✅ |
| **B** | Notifications + messages + user profile endpoints | ✅ |
| **C** | Feed screen — ranked feed, search, infinite scroll | ✅ |
| **C** | Post cards with avatar, username, text, timestamp, reactions | ✅ |
| **C** | CreatePost — heading, content, @mentions, tags, links, image picker | ✅ |
| **D** | SQL queries D1–D4 (`/sql/queries.sql`) | ✅ |
| **D** | Bonus SQL ranking query | ✅ |
| **Tests** | Unit tests — `feedRanking`, `embeddingService` | ✅ |
| **Tests** | Integration tests — posts API (Jest + supertest) | ✅ |
| **Docs** | Swagger UI at `/api/docs` + OpenAPI spec at `/docs/openapi.yaml` | ✅ |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend API | Node.js 20 + TypeScript + Express |
| ORM | Prisma |
| Database | PostgreSQL 15+ |
| Vector Search | pgvector (mocked in dev with in-memory cosine similarity) |
| Embeddings | Deterministic mock (production: sentence-transformers / OpenAI) |
| Auth | JWT Bearer + Refresh Token rotation |
| Validation | Zod |
| Real-time | Socket.io |
| Background Jobs | DB-backed polling (production: BullMQ + Redis) |
| Logging | Winston |
| Tests | Jest + supertest |
| Frontend | React Native (Expo 56) |
| Navigation | React Navigation v7 |

---

## Project Structure

```
guisedup-assessment/
├── backend/
│   ├── src/
│   │   ├── config/          # database.ts, env.ts, swagger.ts
│   │   ├── controllers/     # Route handlers (no business logic)
│   │   ├── embeddings/      # EmbeddingService (mock + production interface)
│   │   ├── jobs/            # embeddingQueue.ts (background embedding generation)
│   │   ├── middleware/      # auth, errorHandler, validate
│   │   ├── models/          # Zod validation schemas
│   │   ├── ranking/         # FeedRankingEngine + 4 strategy classes
│   │   ├── repositories/    # All DB access layer (no SQL in controllers/services)
│   │   ├── routes/          # Express router definitions (9 route modules)
│   │   ├── search/          # VectorSearchService
│   │   ├── services/        # Business logic layer
│   │   ├── socket/          # Socket.io real-time handlers
│   │   ├── tests/           # unit/ + integration/
│   │   ├── utils/           # logger, errors, apiResponse, pagination
│   │   ├── app.ts           # Express app factory
│   │   └── server.ts        # Entry point
│   ├── prisma/
│   │   ├── schema.prisma    # 9 models with indexes
│   │   └── seed.ts          # 3 users, 8 authentic posts
│   ├── .env.example
│   └── jest.config.js
├── frontend/
│   └── src/
│       ├── components/      # atoms, molecules, organisms (Atomic Design)
│       ├── context/         # AuthContext, ThemeContext, SocketContext
│       ├── navigation/      # RootNavigator, TabNavigator, AuthNavigator, stack navigators
│       ├── screens/         # 16 screens (see full list below)
│       ├── services/        # API clients (feedApi, postApi, chatApi, etc.)
│       └── theme/           # colors, typography, spacing
├── sql/
│   └── queries.sql          # D1–D4 + bonus ranking query
└── docs/
    ├── TSD.md               # Technical Solution Document
    └── openapi.yaml         # Complete OpenAPI 3.0.3 specification
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Expo CLI (`npm install -g expo-cli`)

---

### Backend Setup

```bash
cd backend
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env — set DATABASE_URL to your PostgreSQL connection string

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed test data (3 users, 8 posts)
npm run prisma:seed

# Start development server with hot reload
npm run dev
```

Backend starts at `http://localhost:3000`.  
Swagger UI available at `http://localhost:3000/api/docs`.

---

### Frontend Setup

```bash
cd frontend
npm install

# Start Expo dev server
npm start

# Or run directly in browser
npm run web
```

The frontend is fully connected to the backend API. All screens are live — no mock data in production paths.

---

## Test Credentials

After running `npm run prisma:seed`:

| Email | Password |
|-------|----------|
| alice@guisedup.com | password123 |
| bob@guisedup.com | password123 |
| maya@guisedup.com | password123 |

---

## Run Tests

```bash
cd backend

npm test                      # all tests
npm run test:unit             # unit tests only  (feedRanking, embeddingService)
npm run test:integration      # integration tests only  (posts API)
```

---

## API Documentation

Swagger UI is served at runtime:

```
http://localhost:3000/api/docs
http://localhost:3000/api/docs.json
```

The full OpenAPI 3.0.3 spec is also available statically at [`/docs/openapi.yaml`](docs/openapi.yaml).

### Endpoint Summary

**Auth**
```
POST /api/auth/register       { email, username, password }
POST /api/auth/login          { email, password }
POST /api/auth/refresh        { refreshToken }
POST /api/auth/logout         { refreshToken }
GET  /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/verify-otp
POST /api/auth/reset-password
```

**Posts**
```
POST   /api/posts             { text, imageUrl? }
GET    /api/posts/user/me
GET    /api/posts/:id
PUT    /api/posts/:id         { text, imageUrl? }   — owner only
DELETE /api/posts/:id                               — owner only
```

**Feed & Search**
```
GET  /api/feed?cursor=&limit=20
GET  /api/search?q=&limit=10
```

Feed ranking weights:
- **35%** semantic similarity (pgvector cosine)
- **30%** relationship depth (interaction history)
- **20%** authenticity score
- **15%** time decay (48h half-life)

**Interactions**
```
POST /api/interactions        { postId, type: "VIEW"|"REPLY"|"REACTION" }
GET  /api/interactions/post/:postId
```

**Comments**
```
GET    /api/posts/:postId/comments
POST   /api/posts/:postId/comments
DELETE /api/posts/:postId/comments/:id
```

**Notifications**
```
GET  /api/notifications
GET  /api/notifications/unread-count
POST /api/notifications/mark-read
```

**Messages**
```
GET  /api/messages/conversations
GET  /api/messages/conversations/:userId
POST /api/messages
```

**Users**
```
GET  /api/users/search?q=
GET  /api/users/profile/me
PUT  /api/users/profile       { bio?, avatarUrl? }
```

---

## Implemented Screens

| Stack | Screen | Description |
|-------|--------|-------------|
| Auth | Login | JWT login |
| Auth | Signup | Registration |
| Auth | ForgotPassword | Sends OTP |
| Auth | OTPVerification | Verifies OTP |
| Auth | ResetPassword | Sets new password |
| Main | Feed | Ranked feed, search, infinite scroll, filter chips |
| Main | CreatePost | Heading, content, @mentions autocomplete, tags, links, image picker |
| Main | MyPosts | User's own posts with full CRUD — edit + delete |
| Main | ChatList | All conversations |
| Main | ChatRoom | Real-time socket.io messaging |
| Main | Settings | Theme toggle, notifications, profile card, logout |
| Main | EditProfile | Avatar upload, bio edit via expo-image-picker |

---

## SQL Queries

[`/sql/queries.sql`](sql/queries.sql) contains all required queries:

| Query | Description |
|-------|-------------|
| D1 | Top posts by interaction count in the last 7 days |
| D2 | Users who have never posted |
| D3 | Most active users per month |
| D4 | Posts with above-average interaction rates |
| Bonus | Full SQL feed ranking query (weighted score: recency + interactions + semantic similarity) |

---

## Technical Solution Document

[`/docs/TSD.md`](docs/TSD.md) covers:

- Architecture overview and layer diagram
- Database schema design (9 models, indexes, pgvector column)
- API contract decisions
- Feed ranking algorithm design
- Vector search and embedding strategy
- Trade-off analysis (pgvector vs Pinecone, BullMQ vs polling, etc.)
- AI tool usage log

---

## Key Design Decisions

1. **Node.js over Laravel** — TypeScript across the full stack eliminates a class of runtime type errors. Shared types between backend and frontend are a force multiplier on a single-engineer project.

2. **No engagement metrics in ranking** — Likes and shares are deliberately excluded from the feed algorithm. Ranking quality = relevance + authenticity, not virality.

3. **Cursor pagination over offset** — `cursor`-based pagination is O(1) at any depth. Offset pagination degrades at scale and produces duplicates on insert.

4. **Strategy Pattern for ranking** — Each ranking signal (semantic, relationship, authenticity, recency) is an independently injectable strategy class. Signals can be A/B tested or replaced without touching the engine.

5. **Async embeddings** — HTTP requests never block on embedding generation. Posts are inserted immediately; embeddings are enqueued and computed in the background.

6. **pgvector over a dedicated vector DB** — Fewer moving parts for the MVP, no extra infrastructure, and a clear upgrade path at 50M+ posts. All vector operations stay inside a single Postgres transaction boundary.

---

## AI Tool Usage

Primary tool: **Claude Code (claude-sonnet-4-6)** — used for architecture design, boilerplate generation, SQL query optimization, and test case design. All generated code was reviewed, understood, and validated by the engineer before committing. No code was accepted without understanding its intent.
