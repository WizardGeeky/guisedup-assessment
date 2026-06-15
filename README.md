# Guised Up — Real Connections Feed

**Full-Stack Developer Assessment Submission**

> A social platform where content surfaces because it's genuinely relevant to you, not because it went viral.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend API | Node.js + TypeScript + Express |
| ORM | Prisma |
| Database | PostgreSQL |
| Vector Search | pgvector (mocked in dev with in-memory cosine similarity) |
| Embeddings | Deterministic mock (production: sentence-transformers / OpenAI) |
| Auth | JWT Bearer + Refresh Token rotation |
| Validation | Zod |
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
│   │   ├── config/          # database.ts, env.ts
│   │   ├── controllers/     # No business logic — only req/res handling
│   │   ├── embeddings/      # EmbeddingService (mock + production interface)
│   │   ├── jobs/            # embeddingQueue.ts (background embedding generation)
│   │   ├── middleware/      # auth, errorHandler, validate
│   │   ├── models/          # Zod validation schemas
│   │   ├── ranking/         # FeedRankingEngine + 4 strategy classes
│   │   ├── repositories/    # All DB access (no SQL in controllers or services)
│   │   ├── routes/          # Express router definitions
│   │   ├── search/          # VectorSearchService
│   │   ├── services/        # Business logic layer
│   │   ├── tests/           # unit/ + integration/
│   │   ├── utils/           # logger, errors, apiResponse, pagination
│   │   ├── app.ts           # Express app factory
│   │   └── server.ts        # Entry point
│   ├── prisma/
│   │   ├── schema.prisma    # Complete schema with indexes
│   │   └── seed.ts          # Test data (3 users, 8 authentic posts)
│   ├── .env.example
│   └── jest.config.js
├── frontend/
│   └── src/
│       ├── components/      # atoms, molecules, organisms (Atomic Design)
│       ├── data/            # mockData.ts
│       ├── navigation/      # RootNavigator, TabNavigator, AuthNavigator
│       ├── screens/         # All 10 screens
│       └── theme/           # colors, typography, spacing
├── sql/
│   └── queries.sql          # D1–D4 + bonus ranking query
└── docs/
    └── TSD.md               # Technical Solution Document
```

---

## Backend Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 15+

### Install & Run

```bash
cd backend
npm install

# Copy environment variables
cp .env.example .env
# Edit .env — set DATABASE_URL to your PostgreSQL connection string

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed test data
npm run prisma:seed

# Start development server (hot reload)
npm run dev
```

Server starts at `http://localhost:3000`.

### Test Credentials (after seeding)
```
alice@guisedup.com / password123
bob@guisedup.com   / password123
maya@guisedup.com  / password123
```

### Run Tests

```bash
npm test              # all tests
npm run test:unit     # unit tests only
npm run test:integration  # integration tests only
```

---

## API Reference

### Auth
```
POST /api/auth/register   { email, username, password }
POST /api/auth/login      { email, password }
POST /api/auth/refresh    { refreshToken }
POST /api/auth/logout     { refreshToken }
GET  /api/auth/me
```

### Posts
```
POST /api/posts           { text, imageUrl? }
GET  /api/posts/:id
GET  /api/posts/user/me
```

### Feed
```
GET  /api/feed?cursor=&limit=20
```
Returns ranked posts:
- **35%** semantic similarity
- **30%** relationship depth  
- **20%** authenticity score
- **15%** time decay (48h half-life)

### Search
```
GET  /api/search?q=funny travel stories&limit=10
```
Natural language semantic search via vector cosine similarity.

### Interactions
```
POST /api/interactions    { postId, type: "VIEW"|"REPLY"|"REACTION" }
```

---

## Frontend Setup

```bash
cd frontend
npm install
npm start      # Expo dev server
npm run web    # Run in browser
```

Uses dummy data only — all 10 screens are functional with realistic mock content.

---

## SQL Queries

[`/sql/queries.sql`](sql/queries.sql) — D1 through D4 plus a bonus SQL ranking query.

---

## Technical Solution Document

[`/docs/TSD.md`](docs/TSD.md) — Full architecture, schema design, API contracts, ranking algorithm, vector search, trade-offs, and AI tool usage.

---

## Key Design Decisions

1. **No engagement metrics in ranking**: Likes/shares explicitly excluded. Feed quality = relevance + authenticity.
2. **Cursor pagination**: O(1) at any page depth. Offset breaks at scale.
3. **Async embeddings**: HTTP request never waits on embedding generation.
4. **Strategy Pattern for ranking**: Each signal is independently injectable — easy A/B testing and extension.
5. **pgvector over Pinecone**: Fewer moving parts for MVP, clear upgrade path at 50M+ posts.

---

## AI Tool Usage

Primary tool: **Claude Code (claude-sonnet-4-6)** — used for architecture design, code generation, SQL optimization, and test case design. All decisions reviewed and validated by the engineer.
