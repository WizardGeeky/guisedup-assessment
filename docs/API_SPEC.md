# 📡 API Specification — Guised Up Real Connections Feed

> 🔗 **Interactive Swagger UI:** `http://localhost:3000/api/docs`
> 📄 **Machine-readable OpenAPI 3.0.3:** `docs/openapi.yaml`
> 📦 **API Version:** v1

---

## Base URL

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:3000/api` |
| Production | `https://your-domain.com/api` |

All endpoints below are relative to the base URL (e.g., `/auth/login` → `http://localhost:3000/api/auth/login`).

---

## 🔐 Authentication

### Overview

The API uses **JWT Bearer token authentication** with a two-token rotation scheme.

| Token | TTL | Storage recommendation |
|-------|-----|----------------------|
| Access Token | 15 minutes | Memory (not localStorage) |
| Refresh Token | 7 days | `HttpOnly` cookie or secure storage |

### How to Authenticate

```
1. POST /auth/register  or  POST /auth/login
   → Receive: { accessToken, refreshToken, expiresIn }

2. All protected requests:
   Authorization: Bearer <accessToken>

3. When you receive HTTP 401 (token expired):
   POST /auth/refresh  →  { tokens: { accessToken, refreshToken, expiresIn } }
   Retry the original request with the new accessToken

4. On logout:
   POST /auth/logout  →  refresh token revoked server-side
```

### Token Refresh Flow (Axios Interceptor Pattern)

```typescript
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue requests while refresh is in-flight
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        return axiosInstance(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axiosInstance.post('/auth/refresh', {
        refreshToken: getStoredRefreshToken(),
      });
      const newAccessToken = data.data.tokens.accessToken;
      storeAccessToken(newAccessToken);

      // Flush queued requests
      failedQueue.forEach(({ resolve }) => resolve(newAccessToken));
      failedQueue = [];

      originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      failedQueue.forEach(({ reject }) => reject(refreshError));
      failedQueue = [];
      // Redirect to login
      clearTokens();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
```

---

## 📦 Standard Response Envelope

All responses follow a consistent envelope structure.

### Success Response

```json
{
  "success": true,
  "data": { },
  "meta": { },
  "message": "Optional human-readable message"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

> `details` is present only on validation errors (HTTP 400 / 422). It is omitted on 401, 403, 404, etc.

---

## 📊 HTTP Status Codes

| Code | Name | When Used |
|------|------|-----------|
| `200` | OK | Successful GET, PUT, DELETE |
| `201` | Created | Successful POST that creates a resource (post, comment, message) |
| `400` | Bad Request | Malformed request body / invalid parameters |
| `401` | Unauthorized | Missing or expired access token |
| `403` | Forbidden | Token valid but user lacks permission (e.g., editing another user's post) |
| `404` | Not Found | Resource does not exist |
| `409` | Conflict | Duplicate resource (email already registered, interaction already exists) |
| `422` | Unprocessable Entity | Request body fails schema validation (Zod) |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server-side error |

---

## 🚦 Rate Limiting

| Setting | Value |
|---------|-------|
| Window | 15 minutes |
| Max requests | 200 per IP per window |
| Scope | All `/api/*` routes |

**Headers returned on every response:**

| Header | Description |
|--------|-------------|
| `RateLimit-Limit` | Maximum requests per window |
| `RateLimit-Remaining` | Requests remaining in current window |
| `RateLimit-Reset` | Unix timestamp when the window resets |

**Rate limit exceeded response (HTTP 429):**
```json
{
  "success": false,
  "error": "Too many requests, please try again later"
}
```

---

## 🔐 Auth Endpoints

### POST `/auth/register`

Create a new user account.

- **Auth required:** No
- **Content-Type:** `application/json`

**Request body:**
```json
{
  "email": "alice@example.com",
  "username": "alice_codes",
  "password": "securePass123"
}
```

**Validation rules:**
- `email`: valid email format
- `username`: 3-30 characters, `[a-zA-Z0-9_]` only
- `password`: 8-128 characters

**Success response (HTTP 201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "alice@example.com",
      "username": "alice_codes",
      "avatarUrl": null,
      "bio": null
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "a3f8c2d1-7b4e-4c8a-9d2f-1e6b3a5c7e9d",
      "expiresIn": "15m"
    }
  },
  "message": "User registered successfully"
}
```

**Error responses:**
```json
// 409 — email already registered
{ "success": false, "error": "Email already registered" }

// 409 — username taken
{ "success": false, "error": "Username already taken" }

// 422 — validation failure
{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "field": "username", "message": "Username may only contain letters, numbers, and underscores" }
  ]
}
```

---

### POST `/auth/login`

Authenticate with existing credentials.

- **Auth required:** No
- **Content-Type:** `application/json`

**Request body:**
```json
{
  "email": "alice@example.com",
  "password": "securePass123"
}
```

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "alice@example.com",
      "username": "alice_codes",
      "avatarUrl": "https://cdn.example.com/avatars/alice.jpg",
      "bio": "Software engineer | Open source contributor"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "a3f8c2d1-7b4e-4c8a-9d2f-1e6b3a5c7e9d",
      "expiresIn": "15m"
    }
  }
}
```

**Error responses:**
```json
// 401 — wrong credentials (intentionally vague)
{ "success": false, "error": "Invalid email or password" }
```

---

### POST `/auth/refresh`

Exchange a valid refresh token for a new token pair. The old refresh token is immediately revoked (rotation).

- **Auth required:** No
- **Content-Type:** `application/json`

**Request body:**
```json
{
  "refreshToken": "a3f8c2d1-7b4e-4c8a-9d2f-1e6b3a5c7e9d"
}
```

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "b9d7e3f2-8c1a-4d5b-ae6f-2c7d4b8e0f1a",
      "expiresIn": "15m"
    }
  }
}
```

**Error responses:**
```json
// 401 — token expired, revoked, or not found
{ "success": false, "error": "Invalid or expired refresh token" }
```

---

### POST `/auth/logout`

Revoke the current refresh token. The access token will expire naturally after its 15-minute TTL.

- **Auth required:** No (access token optional; refresh token required in body)
- **Content-Type:** `application/json`

**Request body:**
```json
{
  "refreshToken": "a3f8c2d1-7b4e-4c8a-9d2f-1e6b3a5c7e9d"
}
```

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": null,
  "message": "Logged out"
}
```

---

### GET `/auth/me`

Get the currently authenticated user's profile.

- **Auth required:** Yes
- **Headers:** `Authorization: Bearer <accessToken>`

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "alice@example.com",
      "username": "alice_codes",
      "avatarUrl": "https://cdn.example.com/avatars/alice.jpg",
      "bio": "Software engineer | Open source contributor",
      "createdAt": "2026-01-15T10:30:00.000Z"
    }
  }
}
```

---

### POST `/auth/forgot-password`

Initiate password reset. Sends a 6-digit OTP to the registered email address.

- **Auth required:** No

**Request body:**
```json
{
  "email": "alice@example.com"
}
```

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": null,
  "message": "OTP sent"
}
```

> **Note:** Returns HTTP 200 even if the email is not found (prevents email enumeration attacks).

---

### POST `/auth/verify-otp`

Verify the OTP received by email. Returns a short-lived reset token.

- **Auth required:** No

**Request body:**
```json
{
  "email": "alice@example.com",
  "otp": "483921"
}
```

**Validation rules:**
- `otp`: exactly 6 numeric digits

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": {
    "resetToken": "c5d8f1a2-3e7b-4c9d-8f0a-1b2c3d4e5f6a"
  }
}
```

**Error responses:**
```json
// 400 — OTP invalid or expired
{ "success": false, "error": "Invalid or expired OTP" }
```

---

### POST `/auth/reset-password`

Set a new password using the reset token from `/auth/verify-otp`.

- **Auth required:** No

**Request body:**
```json
{
  "token": "c5d8f1a2-3e7b-4c9d-8f0a-1b2c3d4e5f6a",
  "newPassword": "newSecurePass456"
}
```

**Validation rules:**
- `token`: valid UUID format
- `newPassword`: 6-128 characters

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": null,
  "message": "Password reset"
}
```

**Error responses:**
```json
// 400 — token invalid or expired
{ "success": false, "error": "Invalid or expired reset token" }
```

---

## 📝 Posts Endpoints

### POST `/posts`

Create a new post. Triggers async embedding generation via the embedding job queue.

- **Auth required:** Yes

**Request body:**
```json
{
  "text": "Just shipped a feature that reduced our API latency by 40%. Clean indexes make all the difference.",
  "imageUrl": "https://cdn.example.com/images/chart.png"
}
```

**Validation rules:**
- `text`: 1-2000 characters
- `imageUrl`: optional; must be a valid `http(s)://` URL or `data:image/` URI

**Success response (HTTP 201):**
```json
{
  "success": true,
  "data": {
    "post": {
      "id": "7a3b9c2d-4e5f-6789-abcd-ef0123456789",
      "authorId": "550e8400-e29b-41d4-a716-446655440000",
      "text": "Just shipped a feature that reduced our API latency by 40%. Clean indexes make all the difference.",
      "imageUrl": "https://cdn.example.com/images/chart.png",
      "authenticityScore": 0.5,
      "embeddingStatus": "PENDING",
      "viewCount": 0,
      "createdAt": "2026-06-16T09:00:00.000Z",
      "updatedAt": "2026-06-16T09:00:00.000Z",
      "author": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "username": "alice_codes",
        "avatarUrl": "https://cdn.example.com/avatars/alice.jpg"
      }
    },
    "embeddingStatus": "queued"
  },
  "message": "Post created successfully"
}
```

> **Embedding pipeline:** After creation, an `EmbeddingJob` is enqueued. The `embeddingStatus` transitions `PENDING → PROCESSING → DONE` asynchronously. Posts appear in search results only after status reaches `DONE`.

---

### GET `/posts/user/me`

Get all posts authored by the authenticated user, ordered newest first.

- **Auth required:** Yes

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "7a3b9c2d-4e5f-6789-abcd-ef0123456789",
      "authorId": "550e8400-e29b-41d4-a716-446655440000",
      "text": "Just shipped a feature that reduced our API latency by 40%.",
      "imageUrl": null,
      "authenticityScore": 0.72,
      "embeddingStatus": "DONE",
      "viewCount": 143,
      "createdAt": "2026-06-16T09:00:00.000Z",
      "updatedAt": "2026-06-16T09:00:00.000Z",
      "author": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "username": "alice_codes",
        "avatarUrl": "https://cdn.example.com/avatars/alice.jpg"
      },
      "_count": { "interactions": 37 }
    }
  ]
}
```

---

### GET `/posts/:id`

Fetch a single post by ID.

- **Auth required:** Yes
- **Path params:** `id` — post UUID

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": {
    "id": "7a3b9c2d-4e5f-6789-abcd-ef0123456789",
    "authorId": "550e8400-e29b-41d4-a716-446655440000",
    "text": "Just shipped a feature that reduced our API latency by 40%.",
    "imageUrl": null,
    "authenticityScore": 0.72,
    "embeddingStatus": "DONE",
    "viewCount": 143,
    "createdAt": "2026-06-16T09:00:00.000Z",
    "updatedAt": "2026-06-16T09:00:00.000Z",
    "author": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "alice_codes",
      "avatarUrl": "https://cdn.example.com/avatars/alice.jpg"
    },
    "_count": { "interactions": 37 }
  }
}
```

**Error responses:**
```json
// 404
{ "success": false, "error": "Post not found" }
```

---

### PUT `/posts/:id`

Update an existing post. Only the original author may update their post.

- **Auth required:** Yes
- **Path params:** `id` — post UUID

**Request body:**
```json
{
  "text": "Updated: Just shipped a feature that reduced our API latency by 42%.",
  "imageUrl": null
}
```

**Validation rules:**
- `text`: 1-2000 characters (required)
- `imageUrl`: optional URL or data URI; send `null` to remove existing image

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": {
    "id": "7a3b9c2d-4e5f-6789-abcd-ef0123456789",
    "text": "Updated: Just shipped a feature that reduced our API latency by 42%.",
    "imageUrl": null,
    "authenticityScore": 0.72,
    "embeddingStatus": "DONE",
    "viewCount": 143,
    "updatedAt": "2026-06-16T10:15:00.000Z",
    "author": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "alice_codes",
      "avatarUrl": "https://cdn.example.com/avatars/alice.jpg"
    }
  },
  "message": "Post updated successfully"
}
```

**Error responses:**
```json
// 403 — not the author
{ "success": false, "error": "Forbidden" }

// 404
{ "success": false, "error": "Post not found" }
```

---

### DELETE `/posts/:id`

Delete a post. Only the original author may delete their post. Cascades to comments, interactions, and the embedding job.

- **Auth required:** Yes
- **Path params:** `id` — post UUID

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": null,
  "message": "Post deleted successfully"
}
```

**Error responses:**
```json
// 403 — not the author
{ "success": false, "error": "Forbidden" }

// 404
{ "success": false, "error": "Post not found" }
```

---

## 📰 Feed Endpoint

### GET `/feed`

Get the personalized ranked feed for the authenticated user. Posts are scored by a four-signal ranking engine and returned in ranked order.

- **Auth required:** Yes

**Ranking formula:**
```
final_score = (0.35 × semantic_similarity)
            + (0.30 × relationship_depth)
            + (0.20 × authenticity_score)
            + (0.15 × time_decay)
```

| Signal | Weight | Description |
|--------|--------|-------------|
| `semantic` | 35% | Cosine similarity between post embedding and viewer's interest vector |
| `relationship` | 30% | Normalized depth score between viewer and post author |
| `authenticity` | 20% | Pre-computed authenticity heuristic on the post `[0,1]` |
| `timeDecay` | 15% | Exponential decay — posts older than 48h score lower |

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `cursor` | UUID string | — | ID of the last post from the previous page (cursor-based pagination) |
| `limit` | integer | 20 | Posts per page (1–100) |

**Example request:**
```
GET /api/feed?limit=10&cursor=7a3b9c2d-4e5f-6789-abcd-ef0123456789
Authorization: Bearer eyJhbGci...
```

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": [
    {
      "post": {
        "id": "1b2c3d4e-5f67-89ab-cdef-012345678901",
        "authorId": "661e9500-f30c-52e5-b827-557766551111",
        "text": "Excited to share my open-source contribution to Prisma today!",
        "imageUrl": null,
        "authenticityScore": 0.88,
        "embeddingStatus": "DONE",
        "viewCount": 512,
        "createdAt": "2026-06-16T08:00:00.000Z",
        "updatedAt": "2026-06-16T08:00:00.000Z",
        "author": {
          "id": "661e9500-f30c-52e5-b827-557766551111",
          "username": "bob_builds",
          "avatarUrl": "https://cdn.example.com/avatars/bob.jpg"
        }
      },
      "scores": {
        "semantic": 0.82,
        "relationship": 0.65,
        "authenticity": 0.88,
        "timeDecay": 0.95,
        "final": 0.81
      }
    },
    {
      "post": {
        "id": "2c3d4e5f-6789-abcd-ef01-234567890123",
        "authorId": "772f0611-041d-63f6-c938-668877662222",
        "text": "Finally understood how HNSW indexes work. Mind blown.",
        "imageUrl": "https://cdn.example.com/images/hnsw-diagram.png",
        "authenticityScore": 0.91,
        "embeddingStatus": "DONE",
        "viewCount": 89,
        "createdAt": "2026-06-15T22:30:00.000Z",
        "updatedAt": "2026-06-15T22:30:00.000Z",
        "author": {
          "id": "772f0611-041d-63f6-c938-668877662222",
          "username": "carol_crafts",
          "avatarUrl": null
        }
      },
      "scores": {
        "semantic": 0.74,
        "relationship": 0.40,
        "authenticity": 0.91,
        "timeDecay": 0.71,
        "final": 0.70
      }
    }
  ],
  "meta": {
    "hasMore": true,
    "nextCursor": "2c3d4e5f-6789-abcd-ef01-234567890123"
  }
}
```

**Notes:**
- Own posts are excluded from the feed
- The engine fetches `limit × 3` candidates before ranking to allow re-ordering
- `nextCursor` is `null` when `hasMore` is `false`
- Posts with `embeddingStatus !== 'DONE'` still appear in the feed but score 0 on the semantic dimension

---

## 🔍 Search Endpoint

### GET `/search`

Semantic vector search across posts. Returns posts ranked by cosine similarity to the query embedding.

- **Auth required:** Yes

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | — | Search query (required, min 1 char) |
| `limit` | integer | 10 | Max results (1–50) |

**Example request:**
```
GET /api/search?q=database+indexing+strategies&limit=5
Authorization: Bearer eyJhbGci...
```

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": [
    {
      "post": {
        "id": "7a3b9c2d-4e5f-6789-abcd-ef0123456789",
        "authorId": "550e8400-e29b-41d4-a716-446655440000",
        "text": "Just shipped a feature that reduced our API latency by 40%. Clean indexes make all the difference.",
        "imageUrl": null,
        "authenticityScore": 0.72,
        "embeddingStatus": "DONE",
        "viewCount": 143,
        "createdAt": "2026-06-16T09:00:00.000Z",
        "author": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "username": "alice_codes",
          "avatarUrl": "https://cdn.example.com/avatars/alice.jpg"
        }
      },
      "relevanceScore": 0.87
    },
    {
      "post": {
        "id": "3d4e5f60-7890-abcd-ef01-2345678901ab",
        "authorId": "661e9500-f30c-52e5-b827-557766551111",
        "text": "Finally understood how HNSW indexes work. Mind blown.",
        "imageUrl": null,
        "authenticityScore": 0.91,
        "embeddingStatus": "DONE",
        "viewCount": 89,
        "createdAt": "2026-06-15T22:30:00.000Z",
        "author": {
          "id": "661e9500-f30c-52e5-b827-557766551111",
          "username": "bob_builds",
          "avatarUrl": null
        }
      },
      "relevanceScore": 0.81
    }
  ]
}
```

**Notes:**
- Only posts with `embeddingStatus = 'DONE'` appear in search results
- Development: uses in-memory cosine similarity scan
- Production: HNSW approximate nearest-neighbor via pgvector `<=>` operator
- `relevanceScore` is the cosine similarity `[0, 1]` — 1.0 = identical

---

## 💬 Comments Endpoints

### GET `/posts/:postId/comments`

Fetch all comments for a post, ordered newest first.

- **Auth required:** Yes
- **Path params:** `postId` — post UUID

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "4e5f6071-8901-abcd-ef01-3456789012bc",
      "postId": "7a3b9c2d-4e5f-6789-abcd-ef0123456789",
      "authorId": "661e9500-f30c-52e5-b827-557766551111",
      "text": "Great post! What query optimizer are you using?",
      "createdAt": "2026-06-16T09:15:00.000Z",
      "updatedAt": "2026-06-16T09:15:00.000Z",
      "author": {
        "username": "bob_builds",
        "avatarUrl": "https://cdn.example.com/avatars/bob.jpg"
      }
    },
    {
      "id": "5f607182-9012-bcde-f012-456789012bcd",
      "postId": "7a3b9c2d-4e5f-6789-abcd-ef0123456789",
      "authorId": "772f0611-041d-63f6-c938-668877662222",
      "text": "Agreed — composite indexes changed everything for our feed queries.",
      "createdAt": "2026-06-16T09:30:00.000Z",
      "updatedAt": "2026-06-16T09:30:00.000Z",
      "author": {
        "username": "carol_crafts",
        "avatarUrl": null
      }
    }
  ]
}
```

---

### POST `/posts/:postId/comments`

Add a comment to a post. Triggers a COMMENT notification to the post author.

- **Auth required:** Yes
- **Path params:** `postId` — post UUID

**Request body:**
```json
{
  "text": "This is really insightful, thanks for sharing!"
}
```

**Validation rules:**
- `text`: 1-500 characters

**Success response (HTTP 201):**
```json
{
  "success": true,
  "data": {
    "id": "6071829a-0123-cdef-0123-56789012cdef",
    "postId": "7a3b9c2d-4e5f-6789-abcd-ef0123456789",
    "authorId": "550e8400-e29b-41d4-a716-446655440000",
    "text": "This is really insightful, thanks for sharing!",
    "createdAt": "2026-06-16T10:00:00.000Z",
    "updatedAt": "2026-06-16T10:00:00.000Z"
  }
}
```

**Error responses:**
```json
// 404 — post not found
{ "success": false, "error": "Post not found" }
```

---

### DELETE `/posts/:postId/comments/:id`

Delete a comment. Only the comment author may delete their comment.

- **Auth required:** Yes
- **Path params:** `postId` — post UUID, `id` — comment UUID

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": null,
  "message": "Comment deleted"
}
```

**Error responses:**
```json
// 403 — not the comment author
{ "success": false, "error": "Forbidden" }

// 404
{ "success": false, "error": "Comment not found" }
```

---

## ❤️ Interactions Endpoints

### POST `/interactions`

Record a user interaction with a post. Interactions are idempotent per type — sending the same `(postId, type)` combination twice is a no-op.

- **Auth required:** Yes

**Request body:**
```json
{
  "postId": "7a3b9c2d-4e5f-6789-abcd-ef0123456789",
  "type": "REACTION"
}
```

**Interaction types:**
| Type | Meaning | Effect |
|------|---------|--------|
| `VIEW` | Post was seen | Increments `posts.view_count` |
| `REPLY` | User replied/commented | Feeds into relationship depth |
| `REACTION` | User liked/reacted | Triggers REACTION notification to author |

**Success response (HTTP 201):**
```json
{
  "success": true,
  "data": {
    "id": "7182930b-1234-deff-1234-678901234def",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "postId": "7a3b9c2d-4e5f-6789-abcd-ef0123456789",
    "type": "REACTION",
    "createdAt": "2026-06-16T10:05:00.000Z"
  }
}
```

**Error responses:**
```json
// 409 — interaction already exists (idempotent, may also return existing record)
{ "success": false, "error": "Interaction already exists" }

// 404
{ "success": false, "error": "Post not found" }
```

---

### GET `/interactions/post/:postId`

Get aggregated interaction counts for a post, grouped by type.

- **Auth required:** Yes
- **Path params:** `postId` — post UUID

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": {
    "VIEW": 143,
    "REPLY": 12,
    "REACTION": 47
  }
}
```

---

## 🔔 Notifications Endpoints

### GET `/notifications`

Get all notifications for the authenticated user, ordered newest first. Includes sender profile data.

- **Auth required:** Yes

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "8293041c-2345-ef01-2345-789012345ef0",
      "type": "REACTION",
      "message": "bob_builds reacted to your post",
      "isRead": false,
      "createdAt": "2026-06-16T10:05:00.000Z",
      "fromUser": {
        "username": "bob_builds",
        "avatarUrl": "https://cdn.example.com/avatars/bob.jpg"
      }
    },
    {
      "id": "930415d-3456-f012-3456-890123456f01",
      "type": "COMMENT",
      "message": "carol_crafts commented on your post",
      "isRead": true,
      "createdAt": "2026-06-16T09:30:00.000Z",
      "fromUser": {
        "username": "carol_crafts",
        "avatarUrl": null
      }
    }
  ]
}
```

---

### GET `/notifications/unread-count`

Get the count of unread notifications. Suitable for polling or badge updates.

- **Auth required:** Yes

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": {
    "count": 5
  }
}
```

---

### POST `/notifications/mark-read`

Mark all notifications for the authenticated user as read.

- **Auth required:** Yes

**Request body:** none

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": null,
  "message": "Notifications marked as read"
}
```

---

## 💌 Messages Endpoints

### GET `/messages/conversations`

Get all direct message conversations for the authenticated user. Returns one entry per unique conversation partner, with the latest message preview and unread count.

- **Auth required:** Yes

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": [
    {
      "userId": "661e9500-f30c-52e5-b827-557766551111",
      "username": "bob_builds",
      "avatarUrl": "https://cdn.example.com/avatars/bob.jpg",
      "lastMessage": "Did you see the Prisma 6 announcement?",
      "lastMessageAt": "2026-06-16T11:00:00.000Z",
      "unreadCount": 2
    },
    {
      "userId": "772f0611-041d-63f6-c938-668877662222",
      "username": "carol_crafts",
      "avatarUrl": null,
      "lastMessage": "Thanks for the review!",
      "lastMessageAt": "2026-06-15T18:30:00.000Z",
      "unreadCount": 0
    }
  ]
}
```

---

### GET `/messages/conversations/:userId`

Get the full message thread between the authenticated user and another user, ordered chronologically.

- **Auth required:** Yes
- **Path params:** `userId` — UUID of the conversation partner

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "a304152e-4567-0123-4567-901234567012",
      "fromUserId": "661e9500-f30c-52e5-b827-557766551111",
      "toUserId": "550e8400-e29b-41d4-a716-446655440000",
      "text": "Hey, loved your post on database indexing!",
      "isRead": true,
      "createdAt": "2026-06-16T10:55:00.000Z"
    },
    {
      "id": "b415263f-5678-1234-5678-012345678901",
      "fromUserId": "550e8400-e29b-41d4-a716-446655440000",
      "toUserId": "661e9500-f30c-52e5-b827-557766551111",
      "text": "Thanks! Composite indexes are life-changing.",
      "isRead": true,
      "createdAt": "2026-06-16T10:58:00.000Z"
    },
    {
      "id": "c526374a-6789-2345-6789-123456789012",
      "fromUserId": "661e9500-f30c-52e5-b827-557766551111",
      "toUserId": "550e8400-e29b-41d4-a716-446655440000",
      "text": "Did you see the Prisma 6 announcement?",
      "isRead": false,
      "createdAt": "2026-06-16T11:00:00.000Z"
    }
  ]
}
```

---

### POST `/messages`

Send a direct message to another user. Triggers a MESSAGE notification and a Socket.io `new-message` event to the recipient.

- **Auth required:** Yes

**Request body:**
```json
{
  "toUserId": "661e9500-f30c-52e5-b827-557766551111",
  "text": "Did you see the Prisma 6 announcement?"
}
```

**Validation rules:**
- `toUserId`: valid UUID
- `text`: 1-2000 characters

**Success response (HTTP 201):**
```json
{
  "success": true,
  "data": {
    "id": "c526374a-6789-2345-6789-123456789012",
    "fromUserId": "550e8400-e29b-41d4-a716-446655440000",
    "toUserId": "661e9500-f30c-52e5-b827-557766551111",
    "text": "Did you see the Prisma 6 announcement?",
    "isRead": false,
    "createdAt": "2026-06-16T11:00:00.000Z"
  }
}
```

**Error responses:**
```json
// 404 — recipient user not found
{ "success": false, "error": "User not found" }
```

---

## 👤 Users Endpoints

### GET `/users/search`

Search for users by username (prefix match). Used for @mention autocomplete and "Find people" features.

- **Auth required:** Yes

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search query (required) |

**Example request:**
```
GET /api/users/search?q=alice
Authorization: Bearer eyJhbGci...
```

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "alice_codes",
      "avatarUrl": "https://cdn.example.com/avatars/alice.jpg",
      "bio": "Software engineer | Open source contributor"
    },
    {
      "id": "883a1622-152e-74g7-da49-779988773333",
      "username": "alice_designs",
      "avatarUrl": null,
      "bio": "UX designer exploring developer tools"
    }
  ]
}
```

---

### GET `/users/profile/me`

Get the full profile of the authenticated user, including email and account creation date.

- **Auth required:** Yes

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "alice@example.com",
    "username": "alice_codes",
    "avatarUrl": "https://cdn.example.com/avatars/alice.jpg",
    "bio": "Software engineer | Open source contributor",
    "createdAt": "2026-01-15T10:30:00.000Z"
  }
}
```

---

### PUT `/users/profile`

Update the authenticated user's profile. Partial updates are supported — omit fields you do not want to change.

- **Auth required:** Yes

**Request body:**
```json
{
  "bio": "Senior Software Engineer | Postgres enthusiast",
  "avatarUrl": "https://cdn.example.com/avatars/alice-new.jpg"
}
```

**Validation rules:**
- `bio`: max 200 characters (optional)
- `avatarUrl`: valid `http(s)://` URL or `data:image/` URI (optional)

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "alice@example.com",
    "username": "alice_codes",
    "avatarUrl": "https://cdn.example.com/avatars/alice-new.jpg",
    "bio": "Senior Software Engineer | Postgres enthusiast"
  }
}
```

---

## 🔌 WebSocket / Socket.io

The server uses Socket.io for real-time message delivery and live notifications. The Socket.io server runs on the same port as the HTTP server (default: `3000`).

### Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    // Pass the JWT access token (same token used in Authorization header)
    token: accessToken,
  },
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('connect_error', (err) => {
  // err.message === "Unauthorized" if token is missing
  // err.message === "Invalid token" if token is expired/malformed
  console.error('Connection error:', err.message);
});
```

### Authentication

The Socket.io middleware validates the JWT token from `socket.handshake.auth.token` on every connection. If validation fails, the connection is rejected with an error. **No anonymous connections are allowed.**

### Room Architecture

| Room | Format | Who joins |
|------|--------|-----------|
| User room | `user:<userId>` | Every user automatically on connection |
| Post room | `post:<postId>` | Client calls `join-post` event |

### Events Reference

#### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `join-post` | `postId: string` | Subscribe to real-time updates for a specific post (e.g., new comments) |
| `leave-post` | `postId: string` | Unsubscribe from post room updates |

#### Server → Client Events

| Event | Room | Payload | Trigger |
|-------|------|---------|---------|
| `new-message` | `user:<toUserId>` | `Message` object | User receives a direct message via `POST /messages` |
| `notification` | `user:<userId>` | `Notification` object | COMMENT / REACTION / MENTION / MESSAGE event occurs |

### Usage Examples

```javascript
// Subscribe to a post's room when viewing it
socket.emit('join-post', '7a3b9c2d-4e5f-6789-abcd-ef0123456789');

// Listen for incoming messages
socket.on('new-message', (message) => {
  console.log('New DM received:', message);
  // { id, fromUserId, toUserId, text, isRead, createdAt }
  updateConversation(message);
});

// Listen for notifications
socket.on('notification', (notification) => {
  console.log('Notification:', notification);
  // { id, type, message, isRead, createdAt, fromUser: { username, avatarUrl } }
  incrementBadgeCount();
  showToast(notification.message);
});

// Unsubscribe when navigating away from a post
socket.emit('leave-post', '7a3b9c2d-4e5f-6789-abcd-ef0123456789');
```

---

## ❌ Error Code Reference

Complete reference for all error scenarios, their HTTP status codes, and resolution steps.

| HTTP Status | Error Message | Scenario | Resolution |
|-------------|--------------|----------|------------|
| 400 | `"Invalid or expired OTP"` | OTP verification failed | Request a new OTP via `/auth/forgot-password` |
| 400 | `"Invalid or expired reset token"` | Password reset token stale | Restart the password reset flow |
| 401 | `"Unauthorized"` | No `Authorization` header | Include `Authorization: Bearer <token>` |
| 401 | `"Invalid or expired access token"` | JWT expired or malformed | Call `/auth/refresh` to get a new access token |
| 401 | `"Invalid or expired refresh token"` | Refresh token expired or revoked | User must log in again |
| 401 | `"Invalid email or password"` | Login with wrong credentials | Verify credentials |
| 403 | `"Forbidden"` | Authenticated but not authorized | Verify resource ownership |
| 404 | `"Post not found"` | Post ID does not exist | Verify the post ID |
| 404 | `"Comment not found"` | Comment ID does not exist | Verify the comment ID |
| 404 | `"User not found"` | Target user does not exist | Verify the user ID |
| 409 | `"Email already registered"` | Register with duplicate email | Log in or use a different email |
| 409 | `"Username already taken"` | Register with duplicate username | Choose a different username |
| 409 | `"Interaction already exists"` | Duplicate interaction recorded | Interaction is idempotent — this is safe to ignore |
| 422 | `"Validation failed"` | Zod schema validation error | Check `details[]` for field-level messages |
| 429 | `"Too many requests, please try again later"` | Rate limit exceeded (200 req/15min) | Wait for the window to reset (`RateLimit-Reset` header) |
| 500 | `"Internal server error"` | Unexpected server-side failure | Retry with exponential backoff; contact support if persistent |

---

## 🏥 Health Check

### GET `/health`

Check server health. Does not require authentication. Suitable for load balancer health probes.

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-06-16T10:00:00.000Z"
  }
}
```

---

## 📎 Request Size Limits

| Limit | Value |
|-------|-------|
| JSON body | 10 MB |
| URL-encoded body | 10 MB |
| `imageUrl` data URI | Bounded by 10 MB body limit |
| `text` (post) | 2000 characters |
| `text` (comment) | 500 characters |
| `text` (message) | 2000 characters |
| `bio` (profile) | 200 characters |

---

## 🔒 Security Headers

All responses include the following security headers (via `helmet`):

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-XSS-Protection` | `0` (disabled — CSP is preferred) |
| `Strict-Transport-Security` | `max-age=15552000; includeSubDomains` |
| `Content-Security-Policy` | default helmet CSP |

---

## 🧪 Quick Start (cURL Examples)

```bash
# 1. Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","username":"alice_codes","password":"securePass123"}'

# 2. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"securePass123"}'

# 3. Create a post (replace TOKEN with the accessToken from step 2)
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello Guised Up! First post."}'

# 4. Get personalized feed
curl http://localhost:3000/api/feed?limit=10 \
  -H "Authorization: Bearer TOKEN"

# 5. Search posts
curl "http://localhost:3000/api/search?q=database+indexing" \
  -H "Authorization: Bearer TOKEN"

# 6. React to a post (replace POST_ID with an actual post UUID)
curl -X POST http://localhost:3000/api/interactions \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"postId":"POST_ID","type":"REACTION"}'
```
