# 📊 Feed Ranking Algorithm — Guised Up Real Connections Feed

> **Document scope:** A complete technical reference for the feed ranking algorithm that powers the Guised Up "Real Connections Feed." Covers philosophy, formula, all four signals in detail, full pseudocode, worked examples, SQL-level ranking, design decisions, and future roadmap.

---

## 1. Philosophy

### The Problem with Engagement Metrics

Every major social platform — Instagram, TikTok, Twitter/X — optimises for engagement: likes, shares, comments, watch time. The result is well documented: engagement metrics create **algorithmic feedback loops** that amplify outrage, reward sensationalism, and collapse interest diversity.

> "If you liked something, you get more of it" creates echo chambers.

The deeper problem is that engagement metrics are **proxies for attention**, not proxies for value. A post that makes you angry gets a reaction. A post that makes you think may not. A post from an unknown person you'd genuinely connect with never surfaces because they have no prior engagement history.

### The Guised Up Approach

Guised Up's feed is built around a different premise:

**Surface content that is GENUINELY RELEVANT — not just algorithmically addictive.**

This means:

1. **No raw engagement counts.** The ranking engine never reads likes, shares, or view counts as direct ranking signals. (Views are stored for analytics only.)
2. **Semantic relevance over popularity.** Topic alignment between what a user has expressed interest in and what a post is about is the strongest signal (35%).
3. **Genuine relationship over follow graph.** How much has the viewer *actually engaged* (replied, reacted) with this author — not whether they clicked "follow."
4. **Authentic voice over polished content.** Posts that feel human outrank posts that feel like marketing material.
5. **Open discovery pool.** The feed draws from ALL users — not just people the viewer follows — so new voices can break through.

The formula reflects this:

```
Final = (0.35 × Semantic) + (0.30 × Relationship) + (0.20 × Authenticity) + (0.15 × TimeDecay)
```

No engagement metric appears in this formula.

---

## 2. Algorithm Overview

### 2.1 The Formula

```
Final Score = (0.35 × Semantic) + (0.30 × Relationship) + (0.20 × Authenticity) + (0.15 × TimeDecay)
```

All four sub-scores are clamped to `[0.0, 1.0]` before weighting. The final score is also clamped to `[0.0, 1.0]`. All weights sum to 1.0 (verified at engine construction time with a ±0.01 tolerance).

**Weight rationale:**

| Signal | Weight | Rank | Rationale |
|--------|:------:|:----:|-----------|
| 🧠 Semantic Similarity | 0.35 | 1st | Topic relevance is the primary reason to show a post |
| 🤝 Relationship Depth | 0.30 | 2nd | Genuine engagement history signals real connection |
| ✅ Authenticity | 0.20 | 3rd | Authentic voice is the brand differentiator |
| ⏰ Time Decay | 0.15 | 4th | Recency matters but should not dominate relevance |

**Why time decay is lowest:** A highly relevant, authentic post from a trusted author that is 3 days old should still beat a brand-new, irrelevant post from a stranger. Time decay prevents the feed from becoming a pure reverse-chronological stream without abandoning recency entirely.

### 2.2 Candidate Selection

**Open pool:** Candidates are fetched from ALL users (excluding the viewer's own posts) using `postRepository.findRecentPosts(excludeAuthorId, cursor, limit * 3)`. The candidate set is NOT restricted to followed accounts.

**Why open pool matters for discovery:** If candidates were restricted to followed accounts, the feed would reinforce existing connections. New users with zero follows would see an empty feed. The ranking engine handles relevance — candidate selection should cast the widest possible net.

**3× candidate multiplier:** For a page of 20 posts, the service fetches 60 candidates (`CANDIDATE_MULTIPLIER = 3` in `feedService.ts`).

**Why 3× and not just the page size?**

If you only fetch 20 posts and sort them, you are sorting a pre-filtered recency slice — the ranking engine can't rescue a highly relevant older post if it was never fetched. By fetching 60 and re-ranking, the algorithm has headroom to surface the best posts from a wider time window, not just the 20 most recent.

| Multiplier | Trade-off |
|:----------:|---------|
| 1× | No re-ranking benefit; pure chronological |
| 2× | Moderate quality gain; faster DB query |
| **3×** | **Good quality/performance balance (chosen)** |
| 5× | Better diversity but heavier DB read and more ranking compute |

---

## 3. Signal Deep-Dive

### 3.1 🧠 Semantic Similarity (35%)

**File:** `backend/src/ranking/strategies/SemanticSimilarityStrategy.ts`

**What it measures:** How well does this post's topic match what the viewer genuinely cares about?

#### Building the Viewer Interest Embedding

The viewer's interest profile is not stored as an explicit preference list. It is derived dynamically from their interaction history:

```
viewerInteractedPostIds = interactions WHERE:
  userId = viewerUserId
  AND type IN ('REACTION', 'REPLY')
  ORDER BY createdAt DESC
  LIMIT 50

viewerEmbedding = average(embeddings of viewerInteractedPostIds)
```

**Key design choices:**
- Only REACTION and REPLY interactions are used — not VIEW. A view may be accidental; a reaction or reply signals deliberate engagement.
- The last 50 interactions are used (not all-time history) to keep the interest profile current and prevent early interests from dominating.
- Averaging embedding vectors is a standard technique for building a centroid representation of a topic cluster.

#### Cosine Similarity Formula

```
dot_product  = Σ (a[i] × b[i])   for i = 0 .. dim-1
magnitude_a  = √(Σ a[i]²)
magnitude_b  = √(Σ b[i]²)

cosine_similarity = dot_product / (magnitude_a × magnitude_b)

// Raw cosine is in [-1, 1]. Normalize to [0, 1]:
normalized_score = (cosine_similarity + 1) / 2
```

In mathematical notation:

```
sim(a, b) = (a · b) / (‖a‖ × ‖b‖)

score = (sim(a, b) + 1) / 2
```

#### Cold Start (New Users)

A new viewer with no REACTION or REPLY interactions has no embedding. `viewerEmbedding.length === 0` triggers a fallback of `0.5` — a neutral score.

**Why 0.5 and not 0?** A semantic score of 0 multiplied by the weight (0.35) would contribute 0 to the final score, making the other three signals entirely dominate for new users. A 0.5 neutral fallback means new users see a balanced feed where all signals matter proportionally.

**Score range and interpretation:**

| Score | Interpretation |
|:-----:|---------------|
| 0.80–1.00 | Strong topic alignment — very close to the viewer's interest cluster |
| 0.55–0.79 | Moderate alignment — related topics |
| 0.45–0.54 | Neutral (including cold-start fallback of 0.50) |
| 0.25–0.44 | Low alignment — different topic space |
| 0.00–0.24 | Near-orthogonal — very different interests |

**Production path:** Replace in-memory cosine scan with pgvector's `<=>` operator for approximate nearest-neighbor search using an HNSW index.

### 3.2 🤝 Relationship Depth (30%)

**File:** `backend/src/ranking/strategies/RelationshipDepthStrategy.ts`

**What it measures:** How genuinely has the viewer engaged with this post's author over time?

**What "genuine engagement" means:** The total count of interactions (VIEW + REPLY + REACTION) the viewer has performed on *any post by this author*. Computed by `interactionRepository.getRelationshipDepths()` as a single batched query across all candidate authors.

**Why interaction count and not follow graph?** Following is a low-friction action. Interacting with someone's posts repeatedly is a far stronger signal of genuine interest. Someone who has replied to an author 10 times has a deeper relationship than someone who clicked follow once.

#### Log Normalization Formula

```
rawDepth  = total interactions viewer has had with this author

logDepth  = ln(1 + rawDepth)
logMax    = ln(1 + maxRawDepthAcrossAllCandidateAuthors)

score     = logDepth / logMax
```

**Why logarithmic normalization?**

Linear normalization (`rawDepth / maxDepth`) would allow a power user who has interacted with one author 500 times to give that author a score of 1.0 while all others score near 0. The log function compresses the high end, so the difference between 50 and 500 interactions is much smaller than the difference between 0 and 5. This prevents "obsessive fan" behaviour from suppressing all other authors in the feed.

**Cold start score:** `0.1` — when `rawDepth === 0`, the author has never been interacted with. The score is set to a small positive value rather than 0, so new authors are still discoverable.

**Why 0.1 and not 0?** A score of 0 multiplied by the weight (0.30) contributes 0, making cold-start authors compete solely on semantic + authenticity + time decay. The small 0.1 bias keeps new authors visible in discovery contexts without giving them an unfair advantage over genuinely connected authors.

**Score table (assuming maxDepth = 100):**

| Interactions with author | Raw depth | ln(1 + raw) | ln(1 + max) | Score |
|:------------------------:|:---------:|:-----------:|:-----------:|:-----:|
| 0 (new author) | 0 | — | — | **0.10 (cold start)** |
| 1 | 1 | 0.693 | 4.615 | 0.150 |
| 5 | 5 | 1.792 | 4.615 | 0.388 |
| 10 | 10 | 2.398 | 4.615 | 0.520 |
| 25 | 25 | 3.258 | 4.615 | 0.706 |
| 50 | 50 | 3.932 | 4.615 | 0.852 |
| 100 | 100 | 4.615 | 4.615 | **1.000** |

### 3.3 ✅ Authenticity Score (20%)

**File:** `backend/src/ranking/strategies/AuthenticityStrategy.ts`
**Scorer:** `computeAuthenticityScore()` in the same file

**What it measures:** Does this post feel like a real human wrote it, or does it feel like marketing content?

**Computation timing:** Pre-computed at **write time** when the post is created. The result is stored in `Post.authenticityScore`. At ranking time, the strategy simply reads `post.authenticityScore` — O(1), no text processing during ranking.

**Base score:** 0.50. Final score clamped to `[0.10, 1.00]`.

**Complete signal table:**

| Signal | Type | Delta | Implementation |
|--------|:----:|:-----:|----------------|
| Personal pronouns (I, me, my, mine, myself, we, us, our) | ✅ Positive | +0.15 | `/\b(i\|me\|my\|mine\|myself\|we\|us\|our)\b/i` |
| All-lowercase text | ✅ Positive | +0.05 | `text === text.toLowerCase()` |
| Reasonable length (3–150 words) | ✅ Positive | +0.10 | `wordCount >= 3 && wordCount <= 150` |
| Question mark present | ✅ Positive | +0.05 | `text.includes("?")` |
| Ellipsis (…) present | ✅ Positive | +0.03 | `text.includes("...")` |
| No image attached | ✅ Positive | +0.07 | `!imageUrl` |
| >5 hashtags | ❌ Negative | −0.20 | `(text.match(/#\w+/g) ?? []).length > 5` |
| >3 words ALL CAPS (len > 3) | ❌ Negative | −0.15 | Count of words where `word.length > 3 && word === word.toUpperCase()` |
| Stock image URL (unsplash, shutterstock, gettyimages, stockphoto) | ❌ Negative | −0.15 | `/unsplash\|shutterstock\|gettyimages\|stockphoto/i.test(imageUrl)` |

**Why personal pronouns signal authenticity:** First-person language indicates direct personal experience. Marketing copy and professional content rarely uses "I" or "we" in a conversational way. The regex includes `mine`, `myself`, `us`, and `our` to catch fuller personal voice patterns.

**Why >5 hashtags signals marketing:** Personal posts rarely use more than 1–2 hashtags. A post with 6+ hashtags is optimised for discovery and reach rather than genuine expression. The threshold of 5 (not 3) gives reasonable authors who use topic tags a fair chance.

**Why stock image URL detection works:** URLs from Unsplash, Shutterstock, Getty Images, and similar services include the platform domain name in the URL (e.g., `https://images.unsplash.com/photo-...`). The regex is a fast, lightweight signal that does not require fetching or analyzing the image itself.

**Why no-image gets a bonus (+0.07):** Pure text posts tend to be more spontaneous and personal. Image posts — especially with stock photography — suggest a curated, produced aesthetic. The bonus is intentionally small to avoid punishing users who share genuine personal photos.

**Example: High authenticity post**

```
Text: "honestly i've been struggling with this for weeks...
       finally made a breakthrough today and i can't believe
       how obvious it seems now?"
Image: none

Signal breakdown:
  Base:                    0.50
  + Personal pronouns (i): +0.15
  + All lowercase:         +0.05
  + Reasonable length:     +0.10
  + Question mark:         +0.05
  + Ellipsis:              +0.03
  + No image:              +0.07
  (no negative signals)
  = 0.95 → clamped to [0.10, 1.00] → score: 0.95
```

**Example: Low authenticity post**

```
Text: "🔥 GROW YOUR BUSINESS TODAY! USE THESE 7 PROVEN STRATEGIES NOW!!
       #business #marketing #entrepreneur #growth #mindset #success #hustle"
Image: "https://images.unsplash.com/photo-1234..."

Signal breakdown:
  Base:                              0.50
  + Reasonable length (10 words):   +0.10
  - >5 hashtags (7):               -0.20
  - >3 ALL CAPS words:             -0.15
  - Stock image URL (unsplash):    -0.15
  = 0.10 → clamped to [0.10, 1.00] → score: 0.10
```

### 3.4 ⏰ Time Decay (15%)

**File:** `backend/src/ranking/strategies/TimeDecayStrategy.ts`

**What it measures:** How recent is this post?

**Formula:**

```
λ = ln(2) / halfLifeHours = 0.6931 / 48 ≈ 0.01443

score(t) = e^(-λ × t)

where t = hoursElapsed since post.createdAt
```

The `halfLifeHours` parameter is `48`, meaning a post that is exactly 2 days old scores `0.500` — half the score of a brand-new post.

**Why λ = ln(2) / halfLife:** This is the standard exponential decay formula. Setting λ to `ln(2) / T` guarantees that at `t = T`, the score equals `e^(-ln(2)) = 0.5`. This makes the half-life parameter directly interpretable and tunable.

**Why 48-hour half-life?**

| Half-life choice | Effect | Problem |
|:----------------:|--------|---------|
| 24 hours | Yesterday scores 0.50 | Too aggressive — thoughtful posts expire too fast |
| **48 hours** | **2 days scores 0.50** | **Balance: fresh content favoured, meaningful window** |
| 7 days | Last week scores 0.50 | Too lenient — feed loses recency signal |

**Full decay table:**

| Age | Hours elapsed | Score | Interpretation |
|:----|:-------------:|:-----:|----------------|
| Brand new | 0 | 1.000 | Maximum freshness |
| 1 hour | 1 | 0.986 | Essentially new |
| 6 hours | 6 | 0.919 | Still very fresh |
| 12 hours | 12 | 0.843 | Same day |
| 24 hours | 24 | 0.712 | Yesterday — solid recency |
| **48 hours** | **48** | **0.500** | **Half-life point** |
| 4 days | 96 | 0.250 | Aging |
| 7 days | 168 | 0.082 | Old |
| 14 days | 336 | 0.007 | Very old |
| 30 days | 720 | ~0.0001 | Effectively expired |

At weight 0.15, time decay contributes between +0.15 (brand new) and ~0 (30 days old) to the final score. The maximum boost from being fresh is 0.15 points — not enough to overcome a significantly more relevant but slightly older post.

---

## 4. Pseudocode (Full Algorithm)

```
CONSTANTS:
  DEFAULT_PAGE_SIZE   = 20
  CANDIDATE_MULTIPLIER = 3
  LAMBDA              = ln(2) / 48  ≈ 0.01443

WEIGHTS:
  W_SEMANTIC      = 0.35
  W_RELATIONSHIP  = 0.30
  W_AUTHENTICITY  = 0.20
  W_TIMEDECAY     = 0.15


FUNCTION rankFeed(viewerUserId, cursor, limit = 20):

  // Step 1: Open candidate pool — ALL users, exclude viewer's own posts
  candidateLimit = limit * CANDIDATE_MULTIPLIER   // e.g., 60
  candidates = postRepository.findRecentPosts(
    excludeAuthorId = viewerUserId,
    cursor          = cursor,
    limit           = candidateLimit
  )

  if candidates.isEmpty():
    return { posts: [], nextCursor: null, hasMore: false }

  // Step 2: Build ranking context — two queries run in parallel
  authorIds = unique(candidates.map(p => p.authorId))

  [relationshipDepths, viewerEmbedding] = await PARALLEL(
    interactionRepository.getRelationshipDepths(viewerUserId, authorIds),
    vectorSearchService.buildViewerInterestEmbedding(
      getViewerInteractedPostIds(viewerUserId)
    )
  )

  maxDepthScore = max(relationshipDepths.values(), default = 1)

  context = {
    viewerUserId,
    viewerEmbedding,      // number[384], or empty array if cold start
    relationshipDepths,   // Map<authorId, interactionCount>
    maxDepthScore
  }

  // Step 3: Score each candidate using the Strategy Pattern
  rankedPosts = []

  for each post in candidates:
    semantic     = scoreSemanticSimilarity(post, context)
    relationship = scoreRelationshipDepth(post, context)
    authenticity = post.authenticityScore          // pre-computed at write time
    timeDecay    = scoreTimeDecay(post)

    // Clamp each signal independently to [0, 1]
    semantic     = clamp(semantic,     0, 1)
    relationship = clamp(relationship, 0, 1)
    authenticity = clamp(authenticity, 0, 1)
    timeDecay    = clamp(timeDecay,    0, 1)

    finalScore = (W_SEMANTIC      × semantic)
               + (W_RELATIONSHIP  × relationship)
               + (W_AUTHENTICITY  × authenticity)
               + (W_TIMEDECAY     × timeDecay)

    finalScore = clamp(finalScore, 0, 1)

    rankedPosts.push({
      post,
      scores: { semantic, relationship, authenticity, timeDecay, final: finalScore }
    })

  // Step 4: Sort descending by final score
  sorted = rankedPosts.sortByDescending(p => p.scores.final)

  // Step 5: Cursor pagination — take limit+1 to detect hasMore
  pageItems = sorted.slice(0, limit + 1)
  hasMore   = pageItems.length > limit
  pagePosts = pageItems.slice(0, limit)

  nextCursor = if hasMore then pagePosts.last().post.id else null

  return { posts: pagePosts, nextCursor, hasMore }


FUNCTION scoreSemanticSimilarity(post, context):
  if post.embeddingVector is null OR context.viewerEmbedding.length == 0:
    return 0.5   // neutral cold-start fallback

  postVector = JSON.parse(post.embeddingVector)  // number[384]

  dotProduct = 0; normPost = 0; normViewer = 0
  for i in 0..dim-1:
    dotProduct += postVector[i] * viewerEmbedding[i]
    normPost   += postVector[i] ^ 2
    normViewer += viewerEmbedding[i] ^ 2

  denominator = sqrt(normPost) * sqrt(normViewer)
  if denominator == 0: return 0

  cosine = dotProduct / denominator
  return (cosine + 1) / 2     // normalize [-1, 1] → [0, 1]


FUNCTION scoreRelationshipDepth(post, context):
  rawDepth = context.relationshipDepths.get(post.authorId) ?? 0

  if rawDepth == 0:
    return 0.1   // cold start: new author gets slight positive bias

  if context.maxDepthScore == 0:
    return 0.1

  logDepth = ln(1 + rawDepth)
  logMax   = ln(1 + context.maxDepthScore)
  return logDepth / logMax


FUNCTION scoreTimeDecay(post):
  ageMs    = now() - post.createdAt.getTime()
  ageHours = ageMs / (1000 * 60 * 60)
  return exp(-LAMBDA * ageHours)


FUNCTION getViewerInteractedPostIds(viewerUserId):
  return interactions WHERE:
    userId = viewerUserId
    AND type IN ('REACTION', 'REPLY')
  ORDER BY createdAt DESC
  LIMIT 50
  → map to unique postIds


FUNCTION buildViewerInterestEmbedding(interactedPostIds):
  if interactedPostIds is empty:
    return zeros(384)         // cold-start zero vector

  posts   = postRepository.findManyByIds(interactedPostIds)
  vectors = [JSON.parse(p.embeddingVector) for p in posts if p.embeddingVector exists]

  if vectors is empty:
    return zeros(384)

  // Element-wise average across all interaction vectors
  dim    = vectors[0].length   // 384
  avg    = zeros(dim)
  for each vec in vectors:
    for i in 0..dim-1:
      avg[i] += vec[i]
  return avg.map(v => v / vectors.length)
```

---

## 5. Worked Examples

### Example A: New User (Cold Start)

**Viewer:** Created account today, zero interactions.

**Context:**
- `viewerEmbedding`: empty (length 0) → semantic score falls back to 0.5 for all posts
- `relationshipDepths`: empty map → all authors get cold-start score 0.10
- `maxDepthScore`: 1 (default)

**Three candidate posts:**

| Post | Description | Age | Authenticity score |
|:----:|-------------|:---:|:------------------:|
| A | Personal reflection: "honestly i've been struggling with this for weeks... i'm still processing?" | 2h | 0.90 |
| B | Marketing: "7 HACKS TO BOOST PRODUCTIVITY!! #hustle #grind #success #motivation #entrepreneur #winning" | 10 min | 0.10 |
| C | Corporate report: "The quarterly earnings report shows a 14% YoY increase in revenue..." | 30 days | 0.45 |

**Score calculation:**

| | Post A | Post B | Post C |
|--|:------:|:------:|:------:|
| Semantic (×0.35) | 0.50 × 0.35 = **0.175** | 0.50 × 0.35 = **0.175** | 0.50 × 0.35 = **0.175** |
| Relationship (×0.30) | 0.10 × 0.30 = **0.030** | 0.10 × 0.30 = **0.030** | 0.10 × 0.30 = **0.030** |
| Authenticity (×0.20) | 0.90 × 0.20 = **0.180** | 0.10 × 0.20 = **0.020** | 0.45 × 0.20 = **0.090** |
| Time Decay (×0.15) | e^(-0.0144×2) × 0.15 = **0.146** | e^(-0.0144×0.17) × 0.15 = **0.150** | e^(-0.0144×720) × 0.15 = **~0.000** |
| **Final Score** | **0.531** | **0.375** | **0.295** |

**Result order: A (0.531) > B (0.375) > C (0.295)**

**Insight:** For a new user, authenticity and time decay dominate. The authentic personal post wins over the marketing post even though both are semantically equal (cold start 0.5). The 30-day-old post loses almost entirely to time decay — even a reasonable authenticity score cannot save a post that is a month old.

### Example B: Power User

**Viewer:** Has interacted extensively with several authors. Interest profile derived from 30 recent interactions on tech startup posts.

**Context:**
- `viewerEmbedding`: centroid of 30 startup/entrepreneurship post embeddings
- `relationshipDepths`: { author_X: 50, author_Y: 5, author_Z: 0 }
- `maxDepthScore`: 50 (author_X)

**Relationship score pre-computation:**

```
Author X: ln(1 + 50) / ln(1 + 50) = 4.615 / 4.615 = 1.000
Author Y: ln(1 + 5)  / ln(1 + 50) = 1.792 / 4.615 = 0.388
Author Z: cold start = 0.100
```

| | Post D (Author X) | Post E (Author Y) | Post F (Author Z) |
|--|:-----------------:|:-----------------:|:-----------------:|
| **Author** | Power user's favorite | Occasional contact | Stranger |
| **Topic** | Tech startups | Tech startups | Cooking |
| **Age** | 3h | 1h | 10 min |
| **Authenticity** | 0.75 | 0.65 | 0.85 |
| Semantic (×0.35) | 0.80 × 0.35 = **0.280** | 0.80 × 0.35 = **0.280** | 0.30 × 0.35 = **0.105** |
| Relationship (×0.30) | 1.00 × 0.30 = **0.300** | 0.388 × 0.30 = **0.116** | 0.10 × 0.30 = **0.030** |
| Authenticity (×0.20) | 0.75 × 0.20 = **0.150** | 0.65 × 0.20 = **0.130** | 0.85 × 0.20 = **0.170** |
| Time Decay (×0.15) | 0.958 × 0.15 = **0.144** | 0.986 × 0.15 = **0.148** | 0.998 × 0.15 = **0.150** |
| **Final Score** | **0.874** | **0.674** | **0.455** |

**Result order: D (0.874) > E (0.674) > F (0.455)**

**Insight:** For a power user, semantic relevance and relationship depth dominate. Post D wins overwhelmingly because both signals are at their maximum. Post F (highly authentic stranger post about an unrelated topic) scores respectably but does not compete — the open pool means it appears in the candidate set, and ranking appropriately lowers it without hiding it completely.

### Example C: Authenticity Scoring Side-by-Side

| | 🟢 High Authenticity | 🔴 Low Authenticity |
|--|:--------------------:|:-------------------:|
| **Text** | `"i've been putting off this conversation for months... finally did it today. didn't go as planned but i feel lighter?"` | `"TRANSFORM YOUR LIFE WITH THESE PROVEN SECRETS!! #mindset #hustle #success #entrepreneur #motivation #winning #wealth"` |
| **Image** | None | `https://images.unsplash.com/photo-abc123` |
| Personal pronouns | ✅ `i` → +0.15 | ❌ none → +0.00 |
| All lowercase | ✅ → +0.05 | ❌ CAPS → +0.00 |
| Reasonable length | ✅ 22 words → +0.10 | ✅ 10 words → +0.10 |
| Question mark | ✅ → +0.05 | ❌ → +0.00 |
| Ellipsis | ✅ → +0.03 | ❌ → +0.00 |
| No image | ✅ → +0.07 | ❌ → +0.00 |
| >5 hashtags | ❌ (0 hashtags) | ✅ 7 hashtags → −0.20 |
| >3 ALL CAPS words | ❌ | ✅ TRANSFORM, YOUR, LIFE, PROVEN, SECRETS → −0.15 |
| Stock image URL | ❌ | ✅ unsplash → −0.15 |
| **Base** | 0.50 | 0.50 |
| **Total delta** | +0.45 | −0.40 |
| **Raw score** | 0.95 | 0.10 |
| **Clamped score** | **0.95** | **0.10** |

The authenticity dimension alone produces a 0.85-point difference. Multiplied by the weight (0.20), that is a **0.17-point swing** in the final score — enough to move a post several positions in a typical page of 20.

---

## 6. Design Decisions

| Decision | Choice Made | Rationale | Alternative Considered |
|----------|:-----------:|-----------|------------------------|
| No engagement metrics | Explicit exclusion from all signals | Core product differentiator; avoids engagement-bait feedback loops | Use engagement as tie-breaker when other signals tie |
| Semantic weight | 0.35 (highest) | Topic relevance is the primary reason to show a post | 0.25 (give relationship more weight) |
| Relationship weight | 0.30 (second) | Genuine engagement > follow graph as proxy for connection | Follow count or mutual follows |
| Authenticity weight | 0.20 (third) | Important brand differentiator but should not override relevance | 0.25 (equal to semantic) |
| Time decay weight | 0.15 (lowest) | Recency matters but relevance matters more | 0.20, making decay more competitive |
| Open candidate pool | ALL users | Enables discovery; prevents filter bubbles; empty feed problem for new users | Only followed accounts (simpler, weaker discovery) |
| Candidate multiplier | 3× page size | Good quality/performance trade-off | 2× (less quality), 5× (slower query) |
| Strategy Pattern | 4 independent strategies | Each strategy is independently testable, tunable, A/B-testable | Monolithic scoring function in one method |
| Pre-compute authenticity | At write time | O(1) read during ranking; no latency impact on feed | At ranking time (adds text processing to every request) |
| Cold start — semantic | 0.50 (neutral) | New users see a balanced feed; no single signal dominates | 0.0 (penalises new users unfairly) |
| Cold start — relationship | 0.10 (slight positive) | New authors remain discoverable | 0.0 (new authors never surface without history) |
| Half-life | 48 hours | Balance between recency and relevance | 24h (too aggressive), 7d (too lenient) |
| Embedding dimension | 384 | Standard sentence-transformers dimension; good quality/size ratio | 768 (OpenAI ada — more expensive), 128 (too lossy) |
| Vector storage | JSON string in Postgres | No pgvector dependency for assessment | `vector(384)` column with native `<=>` operator (production goal) |
| Viewer embedding source | REACTION + REPLY only | Higher signal quality; VIEW is too passive | All interaction types including VIEW |
| Viewer interaction limit | Last 50 | Keeps interest profile current | All-time history (stale interests dominate) |

---

## 7. SQL-Level Ranking

The file `sql/queries.sql` contains a bonus SQL implementation of the ranking algorithm using CTEs. This illustrates how the algorithm translates to pure SQL — useful for analytics, reporting, or migration to a DB-level ranking approach:

```sql
WITH relationship_depths AS (
    -- Count viewer's interactions per author (cross-post)
    SELECT
        p_inner.author_id,
        COUNT(*)                                                    AS interaction_count,
        LN(1 + COUNT(*)) / LN(1 + MAX(COUNT(*)) OVER ())          AS normalized_depth
    FROM interactions i_inner
    JOIN posts p_inner ON p_inner.id = i_inner.post_id
    WHERE i_inner.user_id = :viewer_user_id
    GROUP BY p_inner.author_id
),
candidate_posts AS (
    -- Open pool: all posts except viewer's own, ordered by recency
    SELECT
        p.*,
        EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0        AS age_hours,
        EXP(-0.0144 * EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0)
                                                                    AS time_decay_score,
        COALESCE(rd.normalized_depth, 0.1)                         AS relationship_score,
        0.5                                                         AS semantic_score
        -- NOTE: 0.5 is the cold-start placeholder.
        -- In production with pgvector:
        --   1 - (p.embedding_vector <=> :viewer_embedding_vector::vector) AS semantic_score
    FROM posts p
    LEFT JOIN relationship_depths rd ON rd.author_id = p.author_id
    WHERE p.author_id <> :viewer_user_id
    ORDER BY p.created_at DESC
    LIMIT :candidate_limit   -- typically page_size * 3
),
scored AS (
    SELECT
        id,
        author_id,
        text,
        image_url,
        created_at,
        authenticity_score,
        semantic_score,
        relationship_score,
        time_decay_score,
        ROUND((
            0.35 * semantic_score
          + 0.30 * relationship_score
          + 0.20 * authenticity_score
          + 0.15 * time_decay_score
        )::NUMERIC, 4)  AS final_score
    FROM candidate_posts
)
SELECT *
FROM scored
ORDER BY final_score DESC
LIMIT :page_size;
```

**Notes on the SQL approach:**
- `semantic_score` is hardcoded to `0.5` as a placeholder until pgvector is enabled in production.
- The rest of the formula translates exactly from TypeScript to SQL — the algorithm is a transparent, deterministic weighted formula that can be audited and explained to any stakeholder.
- In production, add an HNSW index on the `embedding_vector` column for sub-millisecond ANN search.

---

## 8. Future Improvements

### 8.1 ML-Based Ranking

Replace the manually-weighted formula with a learned ranking model (LambdaRank or TF-Ranking).

**Training signal:** User interaction events (REACTION, REPLY) on ranked posts become positive labels; posts shown but not interacted with become negative labels.

**What stays:** The 4 signals become *features* for the model rather than directly weighted scores. The model learns the optimal combination from data.

**Why not now:** Requires labeled training data (minimum ~10,000 interaction events), an offline training pipeline, a serving infrastructure for model inference, and A/B testing to validate uplift. The current formula is transparent, debuggable, and does not require any data collection before launch.

### 8.2 Interest Graph

Replace the simple embedding average with a full interest graph:

```
viewer → [topic clusters] → [post authors]
```

Instead of averaging all interaction embeddings equally, weight them by recency, interaction type depth, and engagement duration. This produces a richer viewer profile that captures evolving interests rather than a static centroid.

**Implementation path:** Store per-topic affinity scores in Redis sorted sets, updated incrementally as interactions occur. Use graph traversal instead of vector mean for building the viewer embedding.

### 8.3 Diversity Injection (MMR)

The current algorithm can suffer from **topic collapse** — if the viewer is deeply interested in one topic, and many candidates cover that topic, the entire feed may be homogeneous.

**Maximal Marginal Relevance (MMR):**

```
For each position in the page:
  Select the candidate that maximizes:
    λ × relevance_score - (1 - λ) × max_cosine_similarity_to_already_selected_posts
```

`λ = 0.7` would prioritise relevance 70% and diversity 30%.

**Implementation:** Run MMR as a post-processing step after the ranking engine produces the sorted list. Compute pairwise cosine similarity between already-selected posts and remaining candidates using stored embeddings. No additional DB queries needed.

### 8.4 A/B Testing Infrastructure

The Strategy Pattern makes weight experimentation zero-code:

```typescript
// Variant A: current weights (production)
const engineA = new FeedRankingEngine([
  new SemanticSimilarityStrategy(),   // 0.35
  new RelationshipDepthStrategy(),    // 0.30
  new AuthenticityStrategy(),         // 0.20
  new TimeDecayStrategy(),            // 0.15
]);

// Variant B: test higher relationship weight
const engineB = new FeedRankingEngine([
  new SemanticSimilarityStrategy(0.30),
  new RelationshipDepthStrategy(0.40),
  new AuthenticityStrategy(0.20),
  new TimeDecayStrategy(0.10),
]);
```

**User bucketing:** Assign users to variants via `userId.hash() % 100`. Bucket 0–49 uses Engine A; bucket 50–99 uses Engine B. Log the variant with every feed request.

**What to measure:** Not raw engagement (that reintroduces the engagement-optimisation problem). Instead: did the viewer find someone they followed, replied to again, or sent a message to? These are "connection quality" metrics aligned with the product's purpose.

### 8.5 Topic Freshness (Differential Decay)

Not all content types have the same freshness window. Different half-life values per content type:

| Content type | Suggested half-life | Detection signal |
|:-------------|:-------------------:|-----------------|
| Breaking news / current events | 12 hours | Keywords: "today," "just," "breaking," "hours ago" |
| Personal reflection / story | 48 hours (current default) | Personal pronouns, narrative structure |
| Tutorial / how-to guide | 7 days | Numbered lists, imperative verbs, code blocks |
| Evergreen wisdom / quote | 30 days | Short, complete, no temporal anchors |

**Implementation:** Classify posts into types using simple keyword heuristics at write time (or a lightweight text classifier). Store the content type on the post. `TimeDecayStrategy` reads the content type and applies the appropriate `halfLifeHours`.

### 8.6 pgvector Migration (Production Path)

The current vector search (`VectorSearchService`) performs an in-memory scan of all posts with `DONE` embedding status. This is suitable for up to ~100,000 posts.

**Production migration steps:**

1. Add `pgvector` extension to Postgres: `CREATE EXTENSION IF NOT EXISTS vector;`
2. Change `Post.embeddingVector` from `String` (JSON) to `vector(384)` in Prisma schema.
3. Create HNSW index for ANN search:
   ```sql
   CREATE INDEX ON posts USING hnsw (embedding_vector vector_cosine_ops);
   ```
4. Replace in-memory cosine scan in `VectorSearchService.search()` with:
   ```sql
   SELECT id, 1 - (embedding_vector <=> $1::vector) AS score
   FROM posts
   WHERE embedding_status = 'DONE'
   ORDER BY embedding_vector <=> $1::vector
   LIMIT $2;
   ```
5. `SemanticSimilarityStrategy` can use the same pgvector index directly for feed ranking, replacing the current in-process cosine similarity computation.

This brings ANN search to millions of posts with sub-10ms latency at the database layer.
