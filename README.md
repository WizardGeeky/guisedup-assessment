# 🎭 Guised Up — Real Connections Feed

[![CI](https://img.shields.io/github/actions/workflow/status/eswar/guisedup-assessment/ci.yml?branch=main&label=CI&logo=github-actions&logoColor=white)](https://github.com/eswar/guisedup-assessment)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo%2056-0EA5E9?logo=react&logoColor=white)](https://expo.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> *"Authentic connections aren't random — they're ranked."*
>
> A full-stack social feed where content surfaces based on **semantic relevance**, **relationship depth**, **authenticity**, and **recency** — not just chronology or virality.

---

## 📋 Assessment Checklist

| Requirement | Status | Details |
|---|---|---|
| **Part A — Documentation** | | |
| Technical Solution Document | ✅ | `docs/TSD.md` — full architecture + trade-off analysis |
| High Level Design | ✅ | `docs/HLD.md` — component topology, data flow |
| Low Level Design | ✅ | `docs/LLD.md` — service contracts, sequence diagrams |
| Database Design | ✅ | `docs/DATABASE_DESIGN.md` — 9 models, indexes, ERD |
| API Specification | ✅ | `docs/API_SPEC.md` + `docs/openapi.yaml` (OpenAPI 3.0.3) |
| Feed Ranking Algorithm doc | ✅ | `docs/FEED_RANKING.md` — signal math, weight rationale |
| AI Usage Log | ✅ | `docs/AI_USAGE.md` — full breakdown |
| Deployment Guide | ✅ | `docs/DEPLOYMENT.md` — Docker, Redis, migrations |
| **Part B — Backend API** | | |
| Node.js 20 + TypeScript + Express | ✅ | Strict TypeScript, Express 4, clean layer separation |
| Prisma ORM + PostgreSQL | ✅ | 9 models, full migration history, seeded test data |
| JWT Auth (access + refresh) | ✅ | 15 min access token / 7-day rotating refresh token |
| Zod request validation | ✅ | All route inputs validated at boundary |
| Swagger UI + OpenAPI | ✅ | `/api/docs` + `docs/openapi.yaml` |
| Winston structured logging | ✅ | Request, error, and audit logs |
| Jest + supertest tests | ✅ | Unit + integration suites |
| **Part B — Feed Algorithm** | | |
| Semantic similarity (embeddings) | ✅ | 384-dim deterministic mock; prod: sentence-transformers |
| Relationship depth signal | ✅ | Weighted by interaction history depth |
| Authenticity score signal | ✅ | Derived from connection + engagement patterns |
| Time decay signal | ✅ | 48-hour exponential half-life |
| Cursor-based pagination | ✅ | `GET /api/feed?cursor=&limit=20` |
| `GET /api/search?q=` | ✅ | Semantic + full-text hybrid search |
| `POST /api/interactions` | ✅ | VIEW, REPLY, REACTION types |
| **Part C — Frontend** | | |
| React Native + Expo 56 | ✅ | Tab + Stack navigators, React Navigation v7 |
| Auth screens (5 screens) | ✅ | Login, Signup, ForgotPassword, OTP, ResetPassword |
| Feed (ranked, infinite scroll) | ✅ | Filter chips, live search, pull-to-refresh |
| Create / Edit / Delete posts | ✅ | Rich editor: @mentions, hashtags, links, image picker |
| Real-time chat (Socket.io) | ✅ | ChatListScreen + ChatRoomScreen |
| Settings + profile editing | ✅ | Theme toggle, notification prefs, avatar upload |
| **Part D — SQL Queries** | | |
| D1 — Users with no posts | ✅ | `sql/queries.sql` |
| D2 — Top 5 users by interactions | ✅ | CTE + window function |
| D3 — Posts with no interactions | ✅ | NOT EXISTS pattern |
| D4 — Mutual connections | ✅ | Self-join on `UserRelationship` |
| BONUS — Composite ranking query | ✅ | All 4 signals computed in SQL |

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                            │
│  React Native + Expo 56 · React Navigation v7 · Socket.io       │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────┐ ┌─────────────┐  │
│  │  Auth Flow  │ │  Feed Screen │ │   Chat   │ │  Settings   │  │
│  │  (5 screens)│ │ ranked+search│ │ (RT msgs)│ │ theme/notif │  │
│  └─────────────┘ └──────────────┘ └──────────┘ └─────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │  HTTP (REST) + WebSocket (Socket.io)
                             │  Authorization: Bearer <jwt>
┌────────────────────────────▼─────────────────────────────────────┐
│                           API LAYER                              │
│  Node.js 20 + Express 4 + TypeScript · Zod · Winston            │
│  ┌──────────────┐ ┌─────────────────┐ ┌──────────────────────┐  │
│  │  JWT Auth    │ │  Feed Ranker    │ │  Socket.io Gateway   │  │
│  │  + Refresh   │ │  (4 strategies) │ │  (msgs + notifs)     │  │
│  └──────────────┘ └─────────────────┘ └──────────────────────┘  │
│  ┌──────────────┐ ┌─────────────────┐ ┌──────────────────────┐  │
│  │  Zod Schemas │ │  Embedding Jobs │ │  Swagger UI /api/docs│  │
│  │  (validation)│ │  (async queue)  │ │  OpenAPI 3.0.3       │  │
│  └──────────────┘ └─────────────────┘ └──────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │  Prisma ORM
┌────────────────────────────▼─────────────────────────────────────┐
│                          DATA LAYER                              │
│  PostgreSQL 15                            Redis (prod only)      │
│  ┌────────────────────────────────────┐  ┌────────────────────┐  │
│  │  9 Models · Indexes · Constraints  │  │  BullMQ Job Queue  │  │
│  │  User, Post, Interaction, Comment  │  │  Embedding workers │  │
│  │  Message, Notification, RelToken   │  └────────────────────┘  │
│  │  EmbeddingJob, UserRelationship    │                           │
│  └────────────────────────────────────┘                           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Backend | Version | Frontend | Version |
|---|---|---|---|
| Node.js | 20.x | React Native | Expo 56 |
| TypeScript | 5.x | React Navigation | v7 |
| Express.js | 4.x | State Management | Context API + hooks |
| Prisma | 5.x | HTTP Client | Axios |
| PostgreSQL | 15 | Real-time | Socket.io client |
| JWT + Refresh Tokens | — | Image Picker | expo-image-picker |
| Zod | 3.x | Storage | AsyncStorage |
| Socket.io | 4.x | UI Components | Custom (Atomic Design) |
| BullMQ + Redis | prod | Icons | @expo/vector-icons |
| Winston | 3.x | Fonts | Expo Google Fonts |
| Jest + supertest | — | Theme | Custom Light/Dark |
| swagger-ui-express | — | | |

---

## 📁 Project Structure

```
guisedup-assessment/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # 9-model schema with indexes
│   │   ├── migrations/            # Full migration history
│   │   └── seed.ts                # 3 seeded users, 8 authentic posts
│   └── src/
│       ├── config/                # database.ts, env.ts, swagger.ts
│       ├── controllers/           # Thin route handlers
│       │   ├── authController.ts
│       │   ├── postController.ts
│       │   ├── feedController.ts
│       │   ├── commentController.ts
│       │   ├── notificationController.ts
│       │   ├── messageController.ts
│       │   └── userController.ts
│       ├── services/              # Business logic layer
│       │   ├── feedRankingService.ts   # 4-signal ranking engine
│       │   ├── embeddingService.ts     # 384-dim vector (mock + prod interface)
│       │   ├── authService.ts
│       │   ├── notificationService.ts
│       │   └── jobQueueService.ts      # DB-backed (dev) / BullMQ (prod)
│       ├── repositories/          # All Prisma data access
│       │   ├── postRepository.ts
│       │   ├── userRepository.ts
│       │   └── interactionRepository.ts
│       ├── middleware/            # Auth guard, Zod validator, error handler
│       ├── models/
│       │   └── schemas.ts         # Zod schemas → TypeScript types
│       ├── routes/                # Express routers (9 modules)
│       ├── socket/                # Socket.io event handlers
│       ├── utils/                 # Logger, errors, apiResponse, pagination
│       ├── tests/
│       │   ├── unit/
│       │   │   ├── feedRanking.test.ts
│       │   │   └── embeddingService.test.ts
│       │   └── integration/
│       │       └── posts.test.ts
│       └── index.ts               # App entry point
├── frontend/
│   └── src/
│       ├── screens/
│       │   ├── auth/
│       │   │   ├── LoginScreen.tsx
│       │   │   ├── SignupScreen.tsx
│       │   │   ├── ForgotPasswordScreen.tsx
│       │   │   ├── OTPVerificationScreen.tsx
│       │   │   └── ResetPasswordScreen.tsx
│       │   ├── FeedScreen.tsx          # Ranked feed, search bar, filter chips
│       │   ├── CreatePostScreen.tsx    # @mentions, hashtags, image picker
│       │   ├── MyPostsScreen.tsx       # CRUD with rich edit modal
│       │   ├── ChatListScreen.tsx      # Conversation list
│       │   ├── ChatRoomScreen.tsx      # Real-time Socket.io messaging
│       │   ├── SettingsScreen.tsx      # Theme toggle, notifications, logout
│       │   └── EditProfileScreen.tsx   # Avatar via expo-image-picker, bio
│       ├── components/            # Atoms, molecules, organisms (Atomic Design)
│       ├── context/               # AuthContext, ThemeContext, SocketContext
│       ├── navigation/            # RootNavigator, TabNavigator, AuthNavigator
│       ├── services/              # feedApi, postApi, chatApi, userApi
│       └── theme/                 # colors, typography, spacing
├── docs/
│   ├── TSD.md                     # Technical Solution Document
│   ├── HLD.md                     # High Level Design
│   ├── LLD.md                     # Low Level Design
│   ├── DATABASE_DESIGN.md         # Schema, indexes, ERD, relationships
│   ├── API_SPEC.md                # Full API specification with examples
│   ├── FEED_RANKING.md            # Ranking algorithm deep-dive
│   ├── AI_USAGE.md                # AI tool usage log (15% of score)
│   ├── DEPLOYMENT.md              # Production deployment guide
│   └── openapi.yaml               # OpenAPI 3.0.3 specification
├── sql/
│   └── queries.sql                # D1–D4 + BONUS composite ranking query
└── README.md
```

---

## 🚀 Quick Start

### Backend Setup

**Prerequisites:** Node.js 20+, PostgreSQL 15+, npm 10+

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Configure environment
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/guisedup"
JWT_SECRET="your-secret-key-minimum-32-characters"
JWT_REFRESH_SECRET="your-refresh-secret-minimum-32-characters"
PORT=3000
NODE_ENV=development
```

```bash
# 3. Generate Prisma client + run migrations
npx prisma generate
npx prisma migrate dev --name init

# 4. Seed the database (creates alice, bob, maya + 8 posts)
npm run prisma:seed

# 5. Start development server (hot-reload)
npm run dev
```

**API base:** `http://localhost:3000`
**Swagger UI:** `http://localhost:3000/api/docs`
**OpenAPI JSON:** `http://localhost:3000/api/docs.json`

---

### Frontend Setup

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. (Optional) Update API base URL
# Edit src/services/api.ts → BASE_URL if backend is not on localhost:3000

# 3. Start Expo development server
npm start

# 4. Choose your target
npx expo start --android   # Android emulator / physical device
npx expo start --ios       # iOS simulator (macOS only)
npx expo start --web       # Browser preview
```

---

## 🔑 Test Credentials

> Run `npm run prisma:seed` in the `backend/` directory first.

| Email | Password | Notes |
|---|---|---|
| alice@guisedup.com | password123 | Primary user — has posts + connections |
| bob@guisedup.com | password123 | Connected to Alice |
| maya@guisedup.com | password123 | Connected to Alice and Bob |

---

## 📖 API Documentation

| Resource | URL |
|---|---|
| **Swagger UI (interactive)** | `http://localhost:3000/api/docs` |
| **OpenAPI JSON** | `http://localhost:3000/api/docs.json` |
| **OpenAPI YAML (static)** | `docs/openapi.yaml` |

### Endpoint Quick Reference

| Module | Method | Path | Auth | Description |
|---|---|---|---|---|
| **Auth** | POST | `/api/auth/register` | — | Register new user |
| | POST | `/api/auth/login` | — | Login → access + refresh tokens |
| | POST | `/api/auth/refresh` | — | Rotate refresh token |
| | POST | `/api/auth/logout` | — | Invalidate refresh token |
| | GET | `/api/auth/me` | ✅ | Current user info |
| | POST | `/api/auth/forgot-password` | — | Initiate OTP reset flow |
| | POST | `/api/auth/verify-otp` | — | Verify OTP code |
| | POST | `/api/auth/reset-password` | — | Set new password |
| **Posts** | POST | `/api/posts` | ✅ | Create post |
| | GET | `/api/posts/user/me` | ✅ | My posts |
| | GET | `/api/posts/:id` | ✅ | Single post |
| | PUT | `/api/posts/:id` | ✅ | Update post (owner only) |
| | DELETE | `/api/posts/:id` | ✅ | Delete post (owner only) |
| **Feed** | GET | `/api/feed?cursor=&limit=20` | ✅ | Ranked personalized feed |
| **Search** | GET | `/api/search?q=&limit=10` | ✅ | Semantic + full-text search |
| **Interactions** | POST | `/api/interactions` | ✅ | Log VIEW / REPLY / REACTION |
| | GET | `/api/interactions/post/:id` | ✅ | Post interaction summary |
| **Comments** | GET | `/api/posts/:id/comments` | ✅ | List comments |
| | POST | `/api/posts/:id/comments` | ✅ | Add comment |
| | DELETE | `/api/posts/:id/comments/:cid` | ✅ | Delete comment (owner only) |
| **Notifications** | GET | `/api/notifications` | ✅ | Notification list |
| | GET | `/api/notifications/unread-count` | ✅ | Badge count |
| | POST | `/api/notifications/mark-read` | ✅ | Mark as read |
| **Messages** | GET | `/api/messages/conversations` | ✅ | Conversation list |
| | GET | `/api/messages/conversations/:userId` | ✅ | Thread with user |
| | POST | `/api/messages` | ✅ | Send message |
| **Users** | GET | `/api/users/search?q=` | ✅ | User search |
| | GET | `/api/users/profile/me` | ✅ | Full profile |
| | PUT | `/api/users/profile` | ✅ | Update profile |

All protected routes require: `Authorization: Bearer <access_token>`

---

## 🧪 Tests

```bash
cd backend

# Run all tests
npm test

# Unit tests only (fast — no DB required)
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Coverage

| File | Type | What's Tested |
|---|---|---|
| `tests/unit/feedRanking.test.ts` | Unit | Signal weights (35/30/20/15%), 48h half-life boundary, cold-start score, log normalization, composite score correctness |
| `tests/unit/embeddingService.test.ts` | Unit | 384-dim output shape, deterministic hashing (same input → same vector), cosine similarity range [−1, 1] |
| `tests/integration/posts.test.ts` | Integration | Full CRUD lifecycle, auth guard (401 on missing token), ownership guard (403 on wrong user), Zod validation errors |

---

## 📊 SQL Queries

All queries live in [`sql/queries.sql`](sql/queries.sql).

| Query | Pattern Used | Description |
|---|---|---|
| **D1** | NOT EXISTS | Users who have never created a post |
| **D2** | CTE + Window Function | Top 5 users by total interactions received |
| **D3** | NOT EXISTS | Posts with zero interactions older than 7 days |
| **D4** | Self-join | Mutual connections between two given users |
| **BONUS** | Composite SQL score | Full feed ranking: semantic weight + relationship depth + time decay, all in SQL |

> D3 uses `NOT EXISTS` rather than `LEFT JOIN … WHERE IS NULL` — the optimizer can short-circuit on the first matching row, avoiding a full scan of the interactions table.

---

## 📚 Documentation Suite

| Document | Description |
|---|---|
| [`docs/TSD.md`](docs/TSD.md) | Technical Solution Document — end-to-end design rationale and decisions |
| [`docs/HLD.md`](docs/HLD.md) | High Level Design — component topology, data flow, deployment topology |
| [`docs/LLD.md`](docs/LLD.md) | Low Level Design — service contracts, class diagrams, sequence flows |
| [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md) | Schema deep-dive — all 9 models, indexes, constraints, ERD |
| [`docs/API_SPEC.md`](docs/API_SPEC.md) | Full API specification with request/response examples |
| [`docs/FEED_RANKING.md`](docs/FEED_RANKING.md) | Ranking algorithm — signal math, weight rationale, cold-start handling |
| [`docs/AI_USAGE.md`](docs/AI_USAGE.md) | Honest AI tool usage log — what was delegated vs. kept human-driven |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Production deployment — Docker, Redis, env vars, migration runbook |
| [`docs/openapi.yaml`](docs/openapi.yaml) | OpenAPI 3.0.3 machine-readable specification |

---

## 🎯 Key Design Decisions

- **TypeScript across the full stack, not just the backend.** Shared type definitions between the backend Zod schemas and the frontend API service layer eliminate an entire class of integration bugs. When the API contract changes, the TypeScript compiler surfaces the mismatch immediately rather than at runtime.

- **No engagement metrics (likes/shares) in feed ranking.** The four signals — semantic similarity, relationship depth, authenticity, and time decay — were deliberately chosen to surface *relevant* content rather than *popular* content. Virality is not authenticity.

- **Cursor pagination over offset.** Offset pagination is O(n) — the database scans and discards `OFFSET` rows before returning results. Cursor pagination using an opaque `timestamp+id` composite key is O(log n) with the right index and produces stable pages even when new posts arrive during an infinite scroll session.

- **Strategy pattern for ranking signals.** Each of the four ranking signals is a pure function with a declared weight. Swapping a signal, reweighting, or A/B testing requires changing one file and zero other layers. Unit testing each signal in isolation is trivial because there are no side effects.

- **Async embedding generation via job queue.** HTTP requests never block waiting for a vector to be computed. Posts are written to the database immediately; embedding generation is enqueued. In development the queue is DB-backed (zero extra infrastructure). In production it upgrades to BullMQ + Redis with retries, dead-letter handling, and horizontal worker scaling — same interface, different driver.

- **Refresh token rotation with reuse detection.** Each refresh token is single-use. After rotation, the previous token is invalidated. If a stolen token is replayed after the legitimate client has already rotated, the server detects the reuse and can invalidate the entire token family, protecting the account with no user action required.

---

## 🤖 AI Tool Usage

This project was developed with **Claude Code (claude-sonnet-4-6)** as the primary AI assistant — for architecture reasoning, TypeScript service generation, SQL query optimization, test case design, and documentation.

All generated output was reviewed against the actual Prisma schema and access patterns before being accepted. No code was committed without the engineer understanding its intent.

See the full breakdown in [`docs/AI_USAGE.md`](docs/AI_USAGE.md) — including what was explicitly *not* delegated to AI and why.

---

## 📄 License

Submitted as a full-stack developer assessment. All rights reserved.

---

<div align="center">

**Built with Node.js · TypeScript · React Native · PostgreSQL · Prisma**

*Powered by Claude Code — AI-augmented engineering, not AI-generated engineering.*

</div>
