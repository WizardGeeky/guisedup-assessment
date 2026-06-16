# 🚀 Deployment Guide — Guised Up

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 20+ | Use `nvm` or `fnm` for version management |
| PostgreSQL | 15+ | With `pgvector` extension for production vector search |
| npm | 10+ | Bundled with Node.js 20 |
| Git | Any | For cloning and version control |
| Expo CLI | Latest | For frontend development (`npm install -g expo-cli`) |

---

## Local Development

### 🔧 Backend Setup

```bash
cd backend
npm install

# Copy example environment file and edit values
cp .env.example .env
# Open .env and set DATABASE_URL and secrets (see Environment Variables table below)

# Generate the Prisma client (must run after any schema change)
npx prisma generate

# Run migrations to create all 9 tables
npx prisma migrate dev --name init

# Seed the database with sample users and posts
npm run prisma:seed

# Start the development server (ts-node-dev with hot reload)
npm run dev
```

After startup:
- **API server**: `http://localhost:3000`
- **Health check**: `http://localhost:3000/health`
- **Swagger UI**: `http://localhost:3000/api/docs`
- **Embedding queue worker**: starts automatically within the same process, polling every 5 seconds

### 🌍 Environment Variables

Create `backend/.env` with the following variables:

| Variable | Required | Default | Example Value | Description |
|----------|----------|---------|---------------|-------------|
| `DATABASE_URL` | ✅ Yes | — | `postgresql://user:pass@localhost:5432/guisedup` | Full PostgreSQL connection string (Prisma format) |
| `JWT_SECRET` | ✅ Yes | `change-me-in-production-must-be-32-chars-min` | `a9f3k2...` (64 hex chars) | Secret for signing access tokens — **minimum 32 characters** |
| `JWT_REFRESH_SECRET` | ✅ Yes | `refresh-secret-change-in-production-32` | `b8e1m4...` (64 hex chars) | Secret for signing refresh tokens — **minimum 32 characters, different from JWT_SECRET** |
| `JWT_EXPIRES_IN` | No | `15m` | `15m` | Access token TTL (ms/zeit format: `15m`, `1h`, `2d`) |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | `7d` | Refresh token TTL |
| `PORT` | No | `3000` | `3000` | TCP port the Express server binds to |
| `NODE_ENV` | No | `development` | `production` | Controls logging verbosity and error detail exposure |
| `CORS_ORIGIN` | No | `*` | `https://app.guisedup.com` | Allowed CORS origin — **set explicitly in production** |
| `EMBEDDING_DIMENSION` | No | `384` | `384` | Vector dimensionality — must match the embedding model in use |

**Minimum `.env` for local development:**
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/guisedup
JWT_SECRET=dev-secret-must-be-at-least-32-characters-long
JWT_REFRESH_SECRET=dev-refresh-must-be-at-least-32-characters
```

### 📱 Frontend Setup

```bash
cd frontend
npm install

# Start the Expo development server (Metro bundler)
npm start

# Or open directly in browser (web preview)
npm run web

# Open on iOS simulator (requires Xcode on macOS)
npx expo run:ios

# Open on Android emulator
npx expo run:android
```

The frontend connects to the API at `http://localhost:3000` by default (configured in `frontend/src/services/apiClient.ts`). Update this to your server URL when deploying.

---

## 🐳 Docker Development

### `docker-compose.yml`

Place this file at the project root:

```yaml
version: '3.9'

services:
  # ── PostgreSQL with pgvector extension ──────────────────────────────────────
  postgres:
    image: pgvector/pgvector:pg16
    container_name: guisedup-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: guisedup
      POSTGRES_PASSWORD: guisedup_dev_password
      POSTGRES_DB: guisedup
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U guisedup -d guisedup"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── Redis (optional, for BullMQ in production) ──────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: guisedup-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── Node.js API Server ──────────────────────────────────────────────────────
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: guisedup-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://guisedup:guisedup_dev_password@postgres:5432/guisedup
      JWT_SECRET: change-me-to-64-char-random-string-in-production-xxxxxx
      JWT_REFRESH_SECRET: change-me-refresh-64-char-random-string-in-production-xx
      JWT_EXPIRES_IN: 15m
      JWT_REFRESH_EXPIRES_IN: 7d
      CORS_ORIGIN: "*"
      EMBEDDING_DIMENSION: 384
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./backend:/app
      - /app/node_modules
    command: >
      sh -c "npx prisma migrate deploy && node dist/server.js"

volumes:
  postgres_data:
  redis_data:
```

### `backend/Dockerfile`

```dockerfile
# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache optimization)
COPY package*.json ./
RUN npm ci --only=production=false

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate
RUN npm run build

# ── Production stage ───────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install only production deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy compiled output and Prisma artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
```

**Running with Docker Compose:**
```bash
# Build and start all services
docker compose up --build

# Start in background
docker compose up -d

# View API logs
docker compose logs -f api

# Stop all services
docker compose down

# Stop and remove volumes (WARNING: deletes all data)
docker compose down -v
```

---

## 🏭 Production Deployment

### Infrastructure Setup

Minimum production requirements:

| Resource | Specification | Notes |
|----------|--------------|-------|
| VPS / VM | 2 vCPU, 4GB RAM | AWS EC2 t3.medium, DigitalOcean Droplet, or equivalent |
| PostgreSQL | Managed or self-hosted | AWS RDS, Supabase, Railway, or self-hosted on same VPS |
| Disk | 20GB+ SSD | For PostgreSQL WAL and data |
| Redis | Optional at launch | Required when upgrading to BullMQ queue |

### 🔒 Environment Hardening

For production, update your `.env` or system environment:

```bash
# Generate cryptographically secure secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Example production .env (never commit this file)
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://guisedup:STRONG_DB_PASS@db-host:5432/guisedup_prod
JWT_SECRET=<64-char hex string from command above>
JWT_REFRESH_SECRET=<different 64-char hex string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=https://app.guisedup.com
EMBEDDING_DIMENSION=384
```

**Checklist before going live:**
- [ ] `JWT_SECRET` is at least 64 characters of random entropy
- [ ] `JWT_REFRESH_SECRET` is different from `JWT_SECRET`
- [ ] `NODE_ENV=production` (disables stack traces in error responses)
- [ ] `CORS_ORIGIN` is set to your exact frontend domain
- [ ] `DATABASE_URL` points to production database with SSL (`?sslmode=require`)
- [ ] `.env` file is **not** committed to git (verify `.gitignore`)

### ⚙️ Process Management (PM2)

```bash
# Install PM2 globally
npm install -g pm2

# Build the TypeScript project first
cd backend && npm run build

# Start with ecosystem config
pm2 start ecosystem.config.js

# Save process list for auto-restart on reboot
pm2 save

# Configure PM2 to start on system boot
pm2 startup
# (run the command it outputs as root/sudo)
```

**`backend/ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [
    {
      name: 'guisedup-api',
      script: './dist/server.js',
      instances: 'max',          // One per CPU core (requires Socket.io Redis adapter for multi-instance)
      exec_mode: 'cluster',      // Node.js cluster mode
      // For single-instance (simpler, no Redis adapter needed):
      // instances: 1,
      // exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_file: '.env',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
```

> ⚠️ **Note on clustering and Socket.io:** If you run `instances: 'max'` (multiple processes), Socket.io connections are not shared between instances. You must add the Socket.io Redis Adapter (`@socket.io/redis-adapter`) so all instances share the same pub/sub channel. For single-VPS deployments, use `instances: 1` to avoid this complexity.

### 🌐 Nginx Reverse Proxy

Install Nginx and create a site config:

```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/guisedup
```

```nginx
upstream guisedup_api {
    server 127.0.0.1:3000;
    # Add more servers here if running multiple PM2 instances behind a load balancer
}

server {
    listen 80;
    server_name api.guisedup.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.guisedup.com;

    # SSL certificates (managed by Certbot — see SSL section below)
    ssl_certificate /etc/letsencrypt/live/api.guisedup.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.guisedup.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers (Helmet handles most, but Nginx can add extras)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy all traffic to Node.js
    location / {
        proxy_pass http://guisedup_api;
        proxy_http_version 1.1;

        # Required for Socket.io WebSocket upgrade
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts — increase for long-polling fallback
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffer settings
        proxy_buffering off;
    }

    # Health check endpoint (bypass rate limiter if needed)
    location /health {
        proxy_pass http://guisedup_api;
        access_log off;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/guisedup /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 🔐 SSL with Let's Encrypt (Certbot)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate (Nginx plugin handles renewal config automatically)
sudo certbot --nginx -d api.guisedup.com

# Certbot auto-renews via systemd timer. Verify:
sudo systemctl status certbot.timer

# Manual renewal test
sudo certbot renew --dry-run
```

---

## 🗄️ Database Management

### Running Migrations

```bash
# Development — applies pending migrations AND pushes schema changes
npx prisma migrate dev

# Development — create a named migration for a schema change
npx prisma migrate dev --name add_user_bio_column

# Production — applies only committed migration files (no schema push)
npx prisma migrate deploy

# Inspect current migration status
npx prisma migrate status
```

### Seeding

```bash
# Run seed script (development only — creates demo users and posts)
npm run prisma:seed

# Or directly:
npx prisma db seed
```

> ⚠️ **Production seeding:** Do not run the seed script against a production database — it creates demo accounts with predictable passwords. Only run `prisma migrate deploy` in production.

### 🔢 Production pgvector Setup

When upgrading from the JSON string mock to native pgvector:

```sql
-- 1. Enable the pgvector extension (requires superuser or pg_extension_owner)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add a native vector column to the posts table
ALTER TABLE posts ADD COLUMN embedding_vector vector(384);

-- 3. Backfill from the existing JSON string column (run in a transaction)
UPDATE posts
SET embedding_vector = embedding_vector_json::vector
WHERE embedding_vector_json IS NOT NULL
  AND embedding_status = 'DONE';

-- 4. Create an HNSW index for approximate nearest-neighbor search
--    m=16, ef_construction=64 are good defaults for ~1M vectors
CREATE INDEX CONCURRENTLY idx_posts_embedding_hnsw
ON posts
USING hnsw (embedding_vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 5. (Optional) Once backfill is verified, drop the old JSON column
-- ALTER TABLE posts DROP COLUMN embedding_vector_json;

-- Verify index was created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'posts' AND indexname = 'idx_posts_embedding_hnsw';
```

**Example vector similarity query (pgvector native):**
```sql
-- Find the 20 posts most semantically similar to a query vector
SELECT id, text, embedding_vector <=> '[0.1, 0.2, ...]'::vector AS distance
FROM posts
WHERE embedding_status = 'DONE'
ORDER BY distance
LIMIT 20;
```

---

## 🤖 Upgrading to Real Embeddings

### Option 1: sentence-transformers (Python Sidecar)

Run a lightweight Python HTTP service alongside the Node.js API:

```python
# embed_service.py — minimal Flask embedding sidecar
from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer

app = Flask(__name__)
model = SentenceTransformer('all-MiniLM-L6-v2')  # 384-dim, MIT license

@app.route('/embed', methods=['POST'])
def embed():
    text = request.json.get('text', '')
    vector = model.encode(text).tolist()
    return jsonify({'embedding': vector})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
```

```bash
pip install flask sentence-transformers
python embed_service.py
```

Then update `backend/src/embeddings/EmbeddingService.ts`:

```typescript
// Replace the mock generateEmbedding with:
async generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('http://localhost:5001/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const { embedding } = await response.json();
  return embedding; // number[384]
}
```

### Option 2: OpenAI API (`text-embedding-3-small`)

If you prefer a managed API over self-hosting:

```bash
npm install openai
```

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 384,         // Request 384-dim output (supported in 3-small)
  });
  return response.data[0]!.embedding;
}
```

> **Note:** OpenAI `text-embedding-3-small` with `dimensions: 384` costs ~$0.00002 per 1k tokens. For high-volume production use, sentence-transformers self-hosted is more cost-effective.

---

## ⚡ Upgrading to BullMQ (Production Queue)

The codebase is designed for a clean swap. The in-process queue in `backend/src/jobs/embeddingQueue.ts` has a comment showing exactly what to replace. Here is the BullMQ equivalent:

```bash
npm install bullmq ioredis
```

```typescript
// backend/src/jobs/embeddingQueue.bullmq.ts
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { embeddingService } from '../embeddings/EmbeddingService';
import { postRepository } from '../repositories/postRepository';
import { embeddingJobRepository } from '../repositories/embeddingJobRepository';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // Required by BullMQ
});

// Producer
export const embeddingQueue = new Queue<{ postId: string }>('embeddings', { connection });

// Worker (can run in a separate process)
export const embeddingWorker = new Worker<{ postId: string }>(
  'embeddings',
  async (job) => {
    const { postId } = job.data;
    await embeddingJobRepository.updateStatus(postId, 'PROCESSING');
    const post = await postRepository.findById(postId);
    if (!post) return;
    const vector = await embeddingService.generateEmbedding(post.text);
    const serialized = embeddingService.serialize(vector);
    await postRepository.updateEmbedding(postId, serialized, 'DONE');
    await embeddingJobRepository.updateStatus(postId, 'DONE');
  },
  {
    connection,
    concurrency: 5,             // Process 5 jobs in parallel
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    },
  },
);
```

The `embeddingQueue.enqueue({ postId })` call in `PostService` only needs the import swapped — the interface is identical.

---

## 📊 Monitoring & Health

### Health Check Endpoint

```bash
curl http://localhost:3000/health
# Returns: {"success":true,"data":{"status":"ok","timestamp":"2026-06-16T10:00:00.000Z"}}
```

Use this with your load balancer's health check configuration and uptime monitors (UptimeRobot, Datadog, etc.).

### Key Metrics to Watch

| Metric | Source | Alert Threshold |
|--------|--------|----------------|
| API response time (p99) | Morgan logs / APM | > 1000ms |
| Embedding queue depth | `SELECT COUNT(*) FROM embedding_jobs WHERE status = 'QUEUED'` | > 100 jobs |
| Failed embedding jobs | `SELECT COUNT(*) FROM embedding_jobs WHERE status = 'FAILED'` | > 10 jobs |
| Active DB connections | `SELECT count(*) FROM pg_stat_activity` | > 80% of max_connections |
| Refresh token count | `SELECT COUNT(*) FROM refresh_tokens WHERE revoked = false AND expires_at > NOW()` | Unusual spikes |
| Rate limit hits | `429` response count in logs | Sustained > 10/min |

### Winston Log Levels

The API uses Winston structured logging. Log output goes to **stdout** in JSON format (PM2 captures to log files).

| Level | When used | Example |
|-------|-----------|---------|
| `error` | Unhandled exceptions, embedding failures | DB connection lost |
| `warn` | Degraded-but-continuing conditions | Ranking weight sum ≠ 1.0 |
| `http` | Every HTTP request (via Morgan) | `GET /api/feed 200 45ms` |
| `info` | Application lifecycle events | Server started, socket connected |
| `debug` | Detailed operation tracing | Embedding generated for post X |

In production (`NODE_ENV=production`), set the minimum log level to `http` or `info`. In development, `debug` is recommended.

**Viewing logs with PM2:**
```bash
# Live tail all logs
pm2 logs guisedup-api

# Last 200 lines
pm2 logs guisedup-api --lines 200

# Error logs only
pm2 logs guisedup-api --err
```

---

## 🛠️ Troubleshooting

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| `Error: connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL not running or wrong host | Verify `pg_isready -h localhost -p 5432`; check `DATABASE_URL` |
| `Invalid environment variables: JWT_SECRET` | `JWT_SECRET` in `.env` is under 32 characters | Generate a longer secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JsonWebTokenError: invalid signature` | `JWT_SECRET` changed after tokens were issued, or wrong env loaded | Restart the server after updating `.env`; all active sessions will need to re-login |
| `TokenExpiredError` on login | Client is sending an expired access token | Ensure client is using the refresh token flow to obtain a new access token |
| Embedding jobs stuck in `QUEUED` | Worker not started (only happens if `startWorker()` call was removed) | Check `npm run dev` output for `"Embedding queue worker started"` line |
| Embedding jobs stuck in `PROCESSING` | Process crashed mid-job | Manually reset: `UPDATE embedding_jobs SET status = 'QUEUED' WHERE status = 'PROCESSING'` |
| `429 Too Many Requests` | Rate limit (200 req / 15 min / IP) hit | Wait 15 minutes; in development, increase `max` in `app.ts` rate limiter config |
| `Cannot find module '@prisma/client'` | `prisma generate` not run after `npm install` | Run `npx prisma generate` |
| `PrismaClientKnownRequestError P2002` | Unique constraint violation (duplicate email/username) | Handle in service layer; client should receive a 409 Conflict response |
| Socket.io connection fails (`Unauthorized`) | JWT not passed in `socket.handshake.auth.token` | Ensure frontend SocketContext passes `auth: { token: accessToken }` to `io()` constructor |
| Feed always empty | No posts in DB from other users | Run `npm run prisma:seed` to populate demo data |
| `relation "users" does not exist` | Migrations not applied | Run `npx prisma migrate dev --name init` |
| Swagger UI not loading | `NODE_ENV=test` disables Swagger (check swagger config) | Set `NODE_ENV=development` for local use |
