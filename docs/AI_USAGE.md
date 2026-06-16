# 🤖 AI Tool Usage — Guised Up Assessment

---

## Overview

This document provides an honest, detailed account of how AI tooling was used throughout the Guised Up assessment. It is written in the spirit the assessment requires: not to minimize AI involvement, and not to overclaim it.

**Primary tool:** Claude Code (`claude-sonnet-4-6`) via the Claude Code CLI
**Usage pattern:** Iterative prompt → review → adjust cycles across every layer of the stack
**Estimated productivity multiplier:** ~5x on boilerplate-heavy tasks (service files, Zod schemas, test scaffolding); ~2x on architecture and design decisions where human judgment was non-negotiable.

AI was used as an **accelerator on implementation**, not as a substitute for engineering judgment. Every output was read, understood, and validated before it was accepted.

---

## Primary Tool: Claude Code (`claude-sonnet-4-6`)

Claude Code is an AI coding assistant integrated into the terminal. It has access to the file system, can read and write files, run commands, and reason across multiple files simultaneously. This made it well-suited to a full-stack project with tight coupling between the Prisma schema, the backend service layer, and the frontend API client types.

---

## How It Was Used

### 1. Architecture Design

**What was delegated to AI:**
- Articulating the trade-offs between competing approaches: `pgvector` vs. a dedicated vector DB (Pinecone / Weaviate), DB-backed queue vs. BullMQ, session tokens vs. stateless JWT
- Drafting the service layer boundary definitions — where repositories end and services begin
- Explaining the Strategy pattern's applicability to the feed ranking problem
- Generating the initial list of Prisma models and their relationships

**What the engineer decided without AI input:**
- The **specific ranking weights** (35% semantic / 30% relationship / 20% authenticity / 15% time decay). These weights reflect a product opinion — that relevance and relationship depth matter more than recency alone — which required understanding the domain, not just the algorithm
- The **stack selection** (Node.js + TypeScript over Laravel/PHP). The TypeScript-across-the-full-stack argument — that shared types eliminate a class of integration bugs on a single-engineer project — was a first-principles engineering judgment
- The **decision to exclude engagement metrics** (likes, shares) from feed ranking. This was a deliberate product stance: ranking quality = relevance + authenticity, not virality. AI cannot make this decision because it requires a product opinion about what "Real Connections" means
- Whether `pgvector` was "good enough" for the MVP scale. The engineer assessed the query access patterns and concluded that keeping vector operations inside the same Postgres transaction boundary was preferable to adding external infrastructure at this stage

---

### 2. Code Generation

**What was delegated:**
- Scaffolding TypeScript service files from a brief description of the contract
- Generating Zod schemas from Prisma model definitions
- Writing Express middleware boilerplate (auth guard, error handler, request validator)
- Producing the initial Socket.io event handler structure
- Generating the BullMQ job queue wrapper with a dev fallback

**Review process applied to every file:**
1. Read the generated output in full — not skimmed
2. Cross-referenced every Prisma call against the actual `schema.prisma` to verify field names and relation traversals
3. Checked that error cases were handled (missing records, unauthorized access, validation failures)
4. Adjusted any output that assumed a different schema shape or that used a pattern inconsistent with the repository layer
5. Removed or rewrote any section that was verbose without adding correctness

**Concrete examples:**
- The `feedRankingService.ts` strategy pattern was AI-scaffolded, but the signal weight constants, the cold-start score default, and the 48-hour half-life constant were written by the engineer and then tested explicitly
- The Prisma `schema.prisma` model definitions were reviewed field-by-field; the `EmbeddingJob` model's `status` enum values and the `UserRelationship` self-referential join were manually adjusted after AI's initial draft produced a less queryable shape
- The Socket.io real-time handlers required three revision passes — the AI's initial output used a namespace pattern that conflicted with the chosen auth middleware structure

**Estimated speed gain:** Approximately 5x faster on files that were primarily structural (middleware, repository layer, Zod schemas). Architecture-sensitive files (ranking engine, auth token rotation) required more human iteration.

---

### 3. SQL Query Optimization

**What was delegated:**
- Generating the initial SQL for each of the D1–D4 queries
- Explaining the difference between `NOT EXISTS` and `LEFT JOIN … WHERE col IS NULL` in terms of optimizer behavior
- Drafting the CTE structure for the D2 window function query

**What the engineer verified independently:**
- That `NOT EXISTS` for D3 (posts with no interactions) is genuinely preferable at scale because the optimizer can short-circuit on the first matching row, rather than computing the full outer join before filtering nulls. This was verified by reading the PostgreSQL query planner documentation.
- That the D2 CTE correctly uses a window function rather than a subquery — the window function preserves all rows while computing the rank, which is the correct shape for "top 5 by interaction count across a rolling period"
- That the BONUS ranking query's weight coefficients match the application-layer constants defined in `feedRankingService.ts`. A discrepancy here would produce different scores in the SQL path vs. the service path — this was manually checked.

---

### 4. Test Case Design

**What was delegated:**
- Generating the initial `describe` / `it` block structure for both unit test files
- Drafting the supertest integration test lifecycle (setup → seed → request → assert → teardown)
- Listing edge cases for the time decay function

**What the engineer added after review:**
- The **48-hour half-life boundary test** — verifying that a post at exactly 48 hours scores 0.5 on the decay signal, and that a post at 0 hours scores 1.0. The AI's initial draft tested the general shape but not the mathematical boundary condition
- The **cold-start assertion** — verifying that a user with no relationship history receives a non-zero feed (default floor score), so new users don't see an empty feed
- The **log normalization edge case** — ensuring that the authenticity score doesn't produce NaN or Infinity when the interaction count is zero (log(0) is undefined)
- Additional 403 test cases in the integration suite to verify that post ownership is enforced, not just authentication

---

### 5. Documentation

**What was delegated:**
- Generating the initial structure and prose for `docs/TSD.md` and `docs/HLD.md`
- Producing the trade-off table format for architecture decisions (e.g., pgvector vs. Pinecone)
- Drafting the OpenAPI 3.0.3 YAML from the route definitions
- Structuring the `FEED_RANKING.md` with the signal math

**What the engineer verified and corrected:**
- All technical claims in the documentation were checked against the actual code. If the code said one thing and the document said another, the document was corrected
- The OpenAPI spec was validated against the actual Zod schemas to ensure request/response shapes matched
- The architecture diagrams were redrawn to accurately reflect the implemented layer structure (the AI's initial ASCII diagram had the job queue in the wrong layer)

---

### 6. UI/UX Iteration — React Native Screens

**What was delegated:**
- Initial screen scaffold for each of the 12 screens (layout, ScrollView structure, StyleSheet)
- Generating the `FlatList` + cursor pagination pattern for `FeedScreen`
- Drafting the `@mentions` autocomplete logic in `CreatePostScreen`
- Socket.io client integration in `ChatRoomScreen`

**Refinement passes:**
- `FeedScreen` required 3 passes: the initial output used a basic FlatList without cursor state, the second pass added cursor but leaked state across filter chip changes, and the third pass added a `useEffect` dependency reset when the active filter changed
- `ChatRoomScreen` required adjustment to the message bubble alignment (sent vs. received) and the socket `emit` / `on` cleanup in the `useEffect` return function
- `SettingsScreen` theme toggle was AI-scaffolded but wired up to the `ThemeContext` manually, as the AI assumed a simpler context shape than the one actually implemented

---

## What Was NOT Delegated to AI

| Decision | Why human judgment was required |
|---|---|
| Feed ranking weight values (35/30/20/15) | Product opinion about what "real connections" means — AI can generate weights but cannot evaluate whether they reflect the right product philosophy |
| Stack selection (Node.js + TS over Laravel) | Depended on the engineer's assessment of TypeScript's value on a single-engineer full-stack project — a judgment call requiring experience with both ecosystems |
| Index design rationale | Required understanding which queries are on the hot path, which are batch, and what the access patterns are — generic indexing advice from AI was too broad |
| pgvector vs. Pinecone decision | Required assessing the operational cost of external infrastructure against the project's MVP scale — a judgment that requires understanding the deployment context |
| Ownership of `NOT EXISTS` vs. `LEFT JOIN` preference | The engineer independently verified the optimizer behavior rather than accepting the AI's claim on trust |
| Business logic review | Every piece of AI-generated business logic was read and mentally executed before being accepted. "Review" meant understanding, not glancing. |
| Token rotation reuse detection design | Security decisions were reasoned through independently; the AI's suggestion was used as a starting point and validated against OWASP token rotation guidance |

---

## Workflow Example

The following is a representative example of the prompt → review → adjust cycle used throughout the project.

**Task:** Implement the `feedRankingService.ts` time decay signal.

**Prompt given to AI:**
> "Write a TypeScript function `computeTimeDecayScore(createdAt: Date): number` that implements exponential time decay with a 48-hour half-life. Score should be 1.0 at t=0 and 0.5 at t=48h. Return a value between 0 and 1."

**AI output (initial):**
```typescript
export function computeTimeDecayScore(createdAt: Date): number {
  const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  return Math.pow(0.5, ageHours / 48);
}
```

**Engineer's review:**
1. Mathematically correct — `0.5^(ageHours/48)` produces 1.0 at t=0 and 0.5 at t=48. Verified by substitution.
2. No edge case for future dates (negative ageHours would produce scores > 1). Added `Math.max(0, ageHours)`.
3. No cap at 1.0 — not strictly necessary given the formula but added defensively.
4. Added a test for the boundary condition: `expect(computeTimeDecayScore(new Date(Date.now() - 48 * 3600 * 1000))).toBeCloseTo(0.5, 2)`.

**Final accepted code:**
```typescript
export function computeTimeDecayScore(createdAt: Date): number {
  const ageHours = Math.max(0, (Date.now() - createdAt.getTime()) / (1000 * 60 * 60));
  return Math.min(1, Math.pow(0.5, ageHours / 48));
}
```

This pattern — generate, verify mathematically, add edge cases, write the boundary test — was applied consistently throughout the project.

---

## Prompt Engineering Notes

Patterns that consistently produced high-quality output:

- **State the contract explicitly, not the implementation.** "Write a function that takes X and returns Y with these properties" produced better code than "implement time decay." AI generates toward a described interface; vague prompts produce vague code.

- **Include the schema as context.** Pasting the relevant Prisma model definitions into the prompt eliminated most field-name errors. The model cannot infer your schema.

- **Ask for edge cases separately.** "What edge cases should I test for this function?" produced more useful edge cases than asking for "tests" directly, because it forced a reasoning step before code generation.

- **Request one thing at a time.** Multi-task prompts ("write the service, the repository, and the tests") produced lower-quality output than three focused prompts. Narrower prompts allow the model to reason more carefully about the single artifact.

- **Verify claims, not just code.** When the AI explained *why* `NOT EXISTS` is preferable to `LEFT JOIN` for D3, that claim was verified independently before accepting it. Technical explanations from AI are plausible, not necessarily correct.

---

## Conclusion

Claude Code significantly accelerated implementation — particularly on structural, boilerplate-heavy work where the shape of the code is well-understood and the main value is in generating it quickly. Middleware, Zod schemas, repository patterns, and screen scaffolding all fell into this category.

The areas where AI augmentation was *least* helpful were the ones requiring product judgment, access pattern analysis, and security reasoning. These required slowing down, thinking independently, and treating AI output as a starting point to validate rather than an answer to accept.

The most honest summary: the code in this project was written with AI assistance, but all engineering decisions were made by the engineer. The difference matters, and it is visible in the parts of the codebase that required the most iteration — the ranking signal weights, the token rotation design, the cold-start handling — where the gap between "AI-generated" and "engineer-validated" is the largest.

**Where AI helped most:** Implementation velocity on well-specified tasks.
**Where AI helped least:** Decisions requiring product opinion, security reasoning, or deep access-pattern knowledge.
**Key limitation noticed:** AI tends to generate optimistic code — it handles the happy path correctly but requires prompting to add edge cases, error branches, and boundary condition tests.

---

*This document was written in partnership with Claude Code, then reviewed and edited to ensure all claims accurately reflect the actual development process.*
