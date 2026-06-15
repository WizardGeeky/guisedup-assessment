-- Guised Up — SQL Challenge Queries
-- These queries assume the schema defined in backend/prisma/schema.prisma
-- Run against PostgreSQL with the migrations applied.
-- All tables: users, posts, interactions, user_relationships, refresh_tokens, embedding_jobs

-- =============================================================================
-- D1: Top 10 most active users in the last 7 days
--     Ranked by total interactions (views + replies + reactions)
-- =============================================================================
-- Approach: Group interactions by user for the past 7 days.
--           Join to users to get email/username.
--           ORDER BY total_interactions DESC, LIMIT 10.
-- Index hit: idx on interactions(user_id, created_at) — covers the WHERE clause efficiently.

SELECT
    u.id                                        AS user_id,
    u.username,
    u.email,
    COUNT(*)                                     AS total_interactions,
    COUNT(*) FILTER (WHERE i.type = 'VIEW')      AS view_count,
    COUNT(*) FILTER (WHERE i.type = 'REPLY')     AS reply_count,
    COUNT(*) FILTER (WHERE i.type = 'REACTION')  AS reaction_count
FROM interactions i
JOIN users u ON u.id = i.user_id
WHERE i.created_at >= NOW() - INTERVAL '7 days'
GROUP BY u.id, u.username, u.email
ORDER BY total_interactions DESC
LIMIT 10;


-- =============================================================================
-- D2: For a given user_id, return all posts from users they interact with most,
--     ordered by interaction frequency descending,
--     limited to posts from the last 30 days.
-- =============================================================================
-- Approach:
--   1. Count how many times :viewer_user_id has interacted with each author's posts.
--   2. Rank authors by interaction count (relationship depth proxy).
--   3. Fetch those authors' recent posts, preserving the interaction frequency order.
-- Two-step CTE for readability and optimizer clarity.

WITH author_depths AS (
    -- Count interactions the viewer has done against each author's posts
    SELECT
        p.author_id,
        COUNT(*) AS interaction_count
    FROM interactions i
    JOIN posts p ON p.id = i.post_id
    WHERE i.user_id = :viewer_user_id           -- parameterized
      AND i.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY p.author_id
    ORDER BY interaction_count DESC
),
recent_posts AS (
    -- All posts from those authors in the last 30 days
    SELECT
        p.id             AS post_id,
        p.author_id,
        p.text,
        p.image_url,
        p.authenticity_score,
        p.view_count,
        p.created_at,
        u.username       AS author_username,
        ad.interaction_count
    FROM posts p
    JOIN users u  ON u.id = p.author_id
    JOIN author_depths ad ON ad.author_id = p.author_id
    WHERE p.created_at >= NOW() - INTERVAL '30 days'
      AND p.author_id <> :viewer_user_id        -- exclude own posts
)
SELECT
    post_id,
    author_id,
    author_username,
    text,
    image_url,
    authenticity_score,
    view_count,
    created_at,
    interaction_count
FROM recent_posts
ORDER BY
    interaction_count DESC,   -- authors ranked by relationship depth
    created_at DESC           -- newest posts from each author first
;


-- =============================================================================
-- D3: Posts viewed more than 100 times but with zero reactions
-- =============================================================================
-- Use case: Identify content that gets surface-level views but no emotional resonance.
--           Useful for authenticity auditing and content moderation signals.
-- Approach: Join posts with aggregated interaction counts, filter by condition.
-- Optimization: view_count is denormalized on the posts table (incremented by trigger)
--               so we can filter view_count > 100 directly without counting interactions.
--               For reactions, we still need to verify against the interactions table.

SELECT
    p.id             AS post_id,
    p.author_id,
    u.username       AS author_username,
    p.view_count,
    p.created_at
FROM posts p
JOIN users u ON u.id = p.author_id
WHERE p.view_count > 100
  AND NOT EXISTS (
      SELECT 1
      FROM interactions i
      WHERE i.post_id = p.id
        AND i.type = 'REACTION'
  )
ORDER BY p.view_count DESC;

-- Alternative using LEFT JOIN + HAVING (equivalent, may be faster on large datasets
-- if the planner chooses a hash join over a nested loop for NOT EXISTS):
-- SELECT
--     p.id AS post_id,
--     p.author_id,
--     u.username,
--     p.view_count,
--     p.created_at
-- FROM posts p
-- JOIN users u ON u.id = p.author_id
-- LEFT JOIN interactions r ON r.post_id = p.id AND r.type = 'REACTION'
-- WHERE p.view_count > 100
-- GROUP BY p.id, p.author_id, u.username, p.view_count, p.created_at
-- HAVING COUNT(r.id) = 0
-- ORDER BY p.view_count DESC;


-- =============================================================================
-- D4: Spam detection — users who created more than 20 posts in the last 24 hours
-- =============================================================================
-- Use case: Rate-limit violators and automated account detection.
--           Returns enough detail to take manual review action.
-- Optimization: Index on posts(author_id, created_at) covers this query efficiently.
--               For very large tables, a partial index (WHERE created_at > NOW()-24h)
--               would be even faster, but requires maintenance.

SELECT
    u.id         AS user_id,
    u.username,
    u.email,
    u.created_at AS account_created_at,
    COUNT(p.id)  AS post_count_24h,
    MIN(p.created_at) AS first_post_in_window,
    MAX(p.created_at) AS last_post_in_window
FROM users u
JOIN posts p ON p.author_id = u.id
WHERE p.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY u.id, u.username, u.email, u.created_at
HAVING COUNT(p.id) > 20
ORDER BY post_count_24h DESC;


-- =============================================================================
-- BONUS: Feed ranking query (raw SQL version of the Node.js FeedRankingEngine)
-- =============================================================================
-- This demonstrates the ranking algorithm at the DB level.
-- In production, this would be combined with pgvector for semantic scoring.
-- The semantic_score here is a placeholder (0.5) — in production it would be:
--   1 - (p.embedding_vector <=> $viewer_embedding::vector) AS semantic_score
-- using pgvector's cosine distance operator.

WITH relationship_depths AS (
    SELECT
        p_inner.author_id,
        LN(1 + COUNT(*)) / LN(1 + MAX(COUNT(*)) OVER ()) AS normalized_depth
    FROM interactions i_inner
    JOIN posts p_inner ON p_inner.id = i_inner.post_id
    WHERE i_inner.user_id = :viewer_user_id
    GROUP BY p_inner.author_id
),
candidate_posts AS (
    SELECT
        p.id,
        p.author_id,
        p.text,
        p.image_url,
        p.authenticity_score,
        p.view_count,
        p.created_at,
        u.username AS author_username,
        -- Time decay: e^(-0.0144 * hours_elapsed), half-life = 48h
        EXP(-0.0144 * EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0) AS time_decay_score,
        COALESCE(rd.normalized_depth, 0.1)                                  AS relationship_score,
        p.authenticity_score                                                 AS authenticity_score_used,
        0.5                                                                  AS semantic_score -- placeholder
    FROM posts p
    JOIN users u ON u.id = p.author_id
    LEFT JOIN relationship_depths rd ON rd.author_id = p.author_id
    WHERE p.author_id <> :viewer_user_id
      AND p.created_at >= NOW() - INTERVAL '30 days'
)
SELECT
    id                AS post_id,
    author_id,
    author_username,
    text,
    image_url,
    view_count,
    created_at,
    ROUND(
        (0.35 * semantic_score +
         0.30 * relationship_score +
         0.20 * authenticity_score_used +
         0.15 * time_decay_score)::NUMERIC,
        4
    )                 AS final_score,
    ROUND(semantic_score::NUMERIC, 4)       AS semantic,
    ROUND(relationship_score::NUMERIC, 4)   AS relationship,
    ROUND(authenticity_score_used::NUMERIC, 4) AS authenticity,
    ROUND(time_decay_score::NUMERIC, 4)     AS time_decay
FROM candidate_posts
ORDER BY final_score DESC
LIMIT 20;
